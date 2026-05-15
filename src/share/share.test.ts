declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => Promise<void> | void) => void;
declare const expect: any;

export {};

const nodeCrypto = require("crypto");

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = nodeCrypto.webcrypto;
}

const {
  SHARE_ACCESS_COOKIE_PURPOSE,
  SHARE_PASSWORD_HASH_ITERATIONS,
  SHARE_PASSWORD_RATE_LIMIT_RULES,
  buildShareAccessCookie,
  buildShareCachePurgeUrls,
  buildSharePasswordRateLimitKeys,
  collectShareCachePathsForSettingsChange,
  collectShareCachePathsForSnapshotUpdate,
  createCloudflareShareCachePurger,
  evaluateShareAccess,
  evaluateShareRateLimit,
  evaluateShareSnapshotUpdate,
  getShareAccessCookiePath,
  hashSharePassword,
  recordShareRateLimitFailure,
  shouldCacheShareListVariant,
  shouldAppearInShareList,
  signShareAccessToken,
  verifyShareAccessToken,
  verifySharePassword,
} = require(".");
const {computeShareSnapshotHash, extractShareAssetIdsFromHtml, hasRenderableShareSnapshot, normalizeShareAssetId} = require("./snapshot");

describe("share modules", () => {
  it("evaluates public permanent share as SSR eligible", () => {
    const share = {
      shareId: "abc123",
      enabled: true,
      listed: true,
      accessType: "public" as const,
      durationType: "permanent" as const,
      startAt: null,
      endAt: null,
      passwordVersion: null,
      htmlSnapshot: "<article><h1>Hello</h1><p>World</p></article>",
      snapshotVersion: 3,
      snapshotHash: "hash-1",
      sanitized: true,
    };

    const decision = evaluateShareAccess({
      share,
      mode: "remote",
      target: "page",
      now: Date.now(),
    });

    expect(decision.code).toBe("allow");
    expect(decision.pageKind).toBe("ssr");
    expect(decision.canRenderSsr).toBe(true);
    expect(decision.robots).toBe("index,follow");
    expect(shouldAppearInShareList(share)).toBe(true);
  });

  it("requires password grant for content access", () => {
    const share = {
      shareId: "pw-share",
      enabled: true,
      listed: false,
      accessType: "password" as const,
      durationType: "permanent" as const,
      startAt: null,
      endAt: null,
      passwordVersion: 2,
      htmlSnapshot: "<p>secret</p>",
      snapshotVersion: 1,
      snapshotHash: "hash-2",
      sanitized: true,
    };

    const pageDecision = evaluateShareAccess({
      share,
      mode: "remote",
      target: "page",
      hasPasswordGrant: false,
    });
    const contentDecision = evaluateShareAccess({
      share,
      mode: "remote",
      target: "content",
      hasPasswordGrant: false,
    });

    expect(pageDecision.code).toBe("allow");
    expect(pageDecision.pageKind).toBe("password");
    expect(contentDecision.code).toBe("forbidden");
    expect(contentDecision.httpStatus).toBe(403);
  });

  it("distinguishes not started and expired ranges", () => {
    const futureShare = {
      shareId: "future",
      enabled: true,
      listed: true,
      accessType: "public" as const,
      durationType: "range" as const,
      startAt: Date.now() + 60_000,
      endAt: Date.now() + 120_000,
      passwordVersion: null,
      htmlSnapshot: "<p>future</p>",
      snapshotVersion: 1,
      snapshotHash: "hash-3",
      sanitized: true,
    };
    const expiredShare = {
      ...futureShare,
      shareId: "expired",
      startAt: Date.now() - 120_000,
      endAt: Date.now() - 60_000,
    };

    expect(evaluateShareAccess({share: futureShare}).httpStatus).toBe(403);
    expect(evaluateShareAccess({share: expiredShare}).httpStatus).toBe(410);
  });

  it("hashes and verifies share passwords with PBKDF2-SHA-256", async () => {
    const derived = await hashSharePassword("plainly-demo-password");

    expect(derived.algo).toBe("pbkdf2-sha256");
    expect(derived.iterations).toBe(SHARE_PASSWORD_HASH_ITERATIONS);
    expect(await verifySharePassword("plainly-demo-password", derived.hash, derived.salt)).toBe(true);
    expect(await verifySharePassword("wrong-password", derived.hash, derived.salt)).toBe(false);
  });

  it("signs and verifies share access token and cookie", async () => {
    const token = await signShareAccessToken(
      {
        shareId: "cookie-share",
        passwordVersion: 3,
      },
      "demo-secret",
      3600,
      1_700_000_000_000,
    );

    const payload = await verifyShareAccessToken(token, "demo-secret", 1_700_000_100_000);
    const cookie = buildShareAccessCookie(token, payload.shareId);

    expect(payload.purpose).toBe(SHARE_ACCESS_COOKIE_PURPOSE);
    expect(payload.passwordVersion).toBe(3);
    expect(getShareAccessCookiePath("cookie-share")).toBe("/read/cookie-share");
    expect(cookie).toContain("plainly_share_access=");
    expect(cookie).toContain("Path=/read/cookie-share");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
  });

  it("builds deterministic snapshot hash and version decision", async () => {
    const snapshotHash = await computeShareSnapshotHash({
      htmlSnapshot: "<article><h1>Hello</h1><p>World</p></article>",
      titleSnapshot: "Hello",
      excerptSnapshot: "World",
    });

    const sameHash = await computeShareSnapshotHash({
      htmlSnapshot: "<article><h1>Hello</h1><p>World</p></article>",
      titleSnapshot: "Hello",
      excerptSnapshot: "World",
    });

    expect(snapshotHash).toBe(sameHash);
    expect(hasRenderableShareSnapshot({htmlSnapshot: "<p>x</p>", snapshotVersion: 1, snapshotHash, sanitized: true})).toBe(
      true,
    );
    expect(
      evaluateShareSnapshotUpdate({
        currentVersion: 3,
        currentHash: snapshotHash,
        incomingVersion: 3,
        incomingHash: snapshotHash,
      }).code,
    ).toBe("idempotent");
    expect(
      evaluateShareSnapshotUpdate({
        currentVersion: 3,
        currentHash: snapshotHash,
        incomingVersion: 2,
        incomingHash: snapshotHash,
      }).code,
    ).toBe("conflict");
  });

  it("evaluates and records password rate limit windows", () => {
    const keys = buildSharePasswordRateLimitKeys("demo-share", "127.0.0.1");
    expect(keys.shareIp).toBe("share:demo-share:ip:127.0.0.1");

    const baseState = {
      failures: SHARE_PASSWORD_RATE_LIMIT_RULES.share_ip.threshold - 1,
      windowStartedAt: 1_700_000_000_000,
      blockedUntil: null,
    };

    const recorded = recordShareRateLimitFailure(baseState, SHARE_PASSWORD_RATE_LIMIT_RULES.share_ip, 1_700_000_010_000);
    expect(recorded.decision.allowed).toBe(false);
    expect(recorded.nextState.blockedUntil).not.toBeNull();

    const blocked = evaluateShareRateLimit(
      {
        failures: 0,
        windowStartedAt: 1_700_000_000_000,
        blockedUntil: recorded.nextState.blockedUntil,
      },
      SHARE_PASSWORD_RATE_LIMIT_RULES.share_ip,
      1_700_000_020_000,
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("extracts only internal image asset ids from snapshot html", () => {
    expect(normalizeShareAssetId("./uploads/demo.png?token=1")).toBe("uploads/demo.png");
    expect(normalizeShareAssetId("https://example.com/demo.png")).toBeNull();
    expect(
      extractShareAssetIdsFromHtml(`
        <article>
          <img src="./uploads/demo.png?token=1" />
          <img src="/private/image-two.jpg" />
          <img src="https://example.com/ignore.png" />
          <img src="data:image/png;base64,AAAA" />
        </article>
      `),
    ).toEqual(["uploads/demo.png", "/private/image-two.jpg"]);
  });

  it("plans cache purge paths for settings and snapshot changes", () => {
    const previousShare = {
      shareId: "old-share",
      enabled: true,
      listed: true,
      accessType: "public" as const,
      durationType: "permanent" as const,
      startAt: null,
      endAt: null,
      passwordVersion: null,
      snapshotVersion: 1,
      snapshotHash: "hash-1",
      titleSnapshot: "旧标题",
      excerptSnapshot: "旧摘要",
    };
    const nextShare = {
      ...previousShare,
      shareId: "new-share",
      listed: false,
      snapshotVersion: 2,
      snapshotHash: "hash-2",
      titleSnapshot: "新标题",
      excerptSnapshot: "新摘要",
    };

    expect(
      collectShareCachePathsForSettingsChange({
        previousShare,
        nextShare,
      }).sort(),
    ).toEqual(["/read", "/read/new-share", "/read/old-share"]);

    expect(
      collectShareCachePathsForSnapshotUpdate({
        previousShare,
        nextShare: previousShare,
        accepted: true,
      }),
    ).toEqual(["/read/old-share", "/read"]);

    expect(buildShareCachePurgeUrls("https://plainly.example.com/", ["/read", "/read/old-share"])).toEqual([
      "https://plainly.example.com/read",
      "https://plainly.example.com/read/old-share",
    ]);
  });

  it("creates a Cloudflare cache purger only when zone and token are configured", async () => {
    const calls: Array<{url: string; init?: RequestInit}> = [];
    const purger = createCloudflareShareCachePurger({
      zoneId: "zone-1",
      apiToken: "token-1",
      fetchImpl: async (url, init) => {
        calls.push({url: String(url), init});
        return new Response(JSON.stringify({success: true}), {status: 200});
      },
    });

    expect(purger).not.toBeNull();
    await purger!.purgeByUrls(["https://plainly.example.com/read/demo"]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/zones/zone-1/purge_cache");
    expect(String(calls[0].init?.body || "")).toContain("https://plainly.example.com/read/demo");
    expect(createCloudflareShareCachePurger({zoneId: "", apiToken: "token-1"})).toBeNull();
  });

  it("caches only the canonical share list variant", () => {
    expect(
      shouldCacheShareListVariant({
        page: 1,
        pageSize: 20,
        hasExplicitPageParam: false,
        hasExplicitPageSizeParam: false,
      }),
    ).toBe(true);
    expect(
      shouldCacheShareListVariant({
        page: 1,
        pageSize: 20,
        hasExplicitPageParam: true,
        hasExplicitPageSizeParam: false,
      }),
    ).toBe(false);
    expect(
      shouldCacheShareListVariant({
        page: 2,
        pageSize: 20,
        hasExplicitPageParam: true,
        hasExplicitPageSizeParam: false,
      }),
    ).toBe(false);
  });
});

import {SHARE_PASSWORD_HASH_ITERATIONS} from "../src/share/security";

type SharePbkdf2Case = {
  name: string;
  hash: "SHA-256" | "SHA-512";
  iterations: number;
  bitLength: number;
  repeats: number;
};

type SharePbkdf2Run = {
  elapsedMs: number;
  hashHexLength: number;
};

type SharePbkdf2Summary = {
  name: string;
  hash: "SHA-256" | "SHA-512";
  iterations: number;
  bitLength: number;
  repeats: number;
  runs: SharePbkdf2Run[];
  averageMs: number;
  maxMs: number;
  minMs: number;
};

const textEncoder = new TextEncoder();

const DEFAULT_PASSWORD = "plainly-share-password-demo";
const DEFAULT_SALT = "plainly-share-salt";

const DEFAULT_CASES: SharePbkdf2Case[] = [
  {
    name: "current-auth-baseline",
    hash: "SHA-512",
    iterations: 1000,
    bitLength: 512,
    repeats: 3,
  },
  {
    name: "share-target",
    hash: "SHA-256",
    iterations: SHARE_PASSWORD_HASH_ITERATIONS,
    bitLength: 256,
    repeats: 3,
  },
];

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const nowMs = () => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
};

const derivePbkdf2 = async (password: string, salt: string, hash: "SHA-256" | "SHA-512", iterations: number, bitLength: number) => {
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash,
      iterations,
      salt: textEncoder.encode(salt),
    },
    key,
    bitLength,
  );
  return bytesToHex(new Uint8Array(derivedBits));
};

const measureCase = async (testCase: SharePbkdf2Case, password: string, salt: string): Promise<SharePbkdf2Summary> => {
  const runs: SharePbkdf2Run[] = [];

  for (let i = 0; i < testCase.repeats; i += 1) {
    const startedAt = nowMs();
    const hashHex = await derivePbkdf2(password, salt, testCase.hash, testCase.iterations, testCase.bitLength);
    const elapsedMs = Number((nowMs() - startedAt).toFixed(3));
    runs.push({
      elapsedMs,
      hashHexLength: hashHex.length,
    });
  }

  const total = runs.reduce((sum, item) => sum + item.elapsedMs, 0);
  const averageMs = Number((total / runs.length).toFixed(3));
  const maxMs = Number(Math.max(...runs.map((item) => item.elapsedMs)).toFixed(3));
  const minMs = Number(Math.min(...runs.map((item) => item.elapsedMs)).toFixed(3));

  return {
    name: testCase.name,
    hash: testCase.hash,
    iterations: testCase.iterations,
    bitLength: testCase.bitLength,
    repeats: testCase.repeats,
    runs,
    averageMs,
    maxMs,
    minMs,
  };
};

export const runSharePbkdf2WorkerPoC = async (cases: SharePbkdf2Case[] = DEFAULT_CASES) => {
  const summaries: SharePbkdf2Summary[] = [];
  for (const testCase of cases) {
    summaries.push(await measureCase(testCase, DEFAULT_PASSWORD, DEFAULT_SALT));
  }
  return {
    runtime: "cloudflare-worker-webcrypto",
    passwordLength: DEFAULT_PASSWORD.length,
    saltLength: DEFAULT_SALT.length,
    cases: summaries,
  };
};

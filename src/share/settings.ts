import {Category, DocumentMeta, DocumentShare, SaveDocumentShareInput, UpdateDocumentMetaInput} from "../data/store/types";
import {getDefaultListedValue, resolveListedValue} from "./policy";
import {
  SHARE_EXCERPT_SNAPSHOT_MAX_CHARS,
  computeShareSnapshotHash,
  evaluateShareSnapshotUpdate,
  normalizeShareSnapshotText,
  validateShareSnapshotPayload,
} from "./snapshot";
import {
  DocumentSettingsPayload,
  DocumentShareSettings,
  ShareSnapshotUpdateDecision,
  UpdateDocumentSettingsInput,
  UpdateShareSnapshotInput,
} from "./types";

export const buildSharePublicUrl = (origin: string, shareId?: string | null): string | undefined => {
  const normalizedOrigin = String(origin || "").replace(/\/+$/g, "");
  const normalizedShareId = String(shareId || "").trim();
  if (!normalizedOrigin || !normalizedShareId) return undefined;
  return `${normalizedOrigin}/read/${encodeURIComponent(normalizedShareId)}`;
};

const toMillis = (value: DocumentShare["startAt"] | DocumentShare["endAt"]): number | null => {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

export const serializeDocumentShareSettings = (
  share: DocumentShare | null,
  origin?: string | null,
): DocumentShareSettings | null => {
  if (!share) return null;
  return {
    enabled: Boolean(share.enabled),
    listed: Boolean(share.listed),
    shareId: share.shareId,
    accessType: share.accessType,
    durationType: share.durationType,
    startAt: toMillis(share.startAt),
    endAt: toMillis(share.endAt),
    passwordConfigured: Boolean(share.passwordHash),
    passwordVersion: share.passwordVersion ?? null,
    publicUrl: buildSharePublicUrl(String(origin || ""), share.shareId),
    snapshotVersion: share.snapshotVersion ?? null,
    snapshotHash: share.snapshotHash ?? null,
    htmlSnapshot: share.htmlSnapshot ?? null,
    titleSnapshot: share.titleSnapshot ?? null,
    excerptSnapshot: share.excerptSnapshot ?? null,
  };
};

export const buildDocumentSettingsPayload = (input: {
  meta: DocumentMeta | null;
  categories: Category[];
  share: DocumentShare | null;
  origin?: string | null;
}): DocumentSettingsPayload => ({
  meta: input.meta,
  categories: input.categories,
  share: serializeDocumentShareSettings(input.share, input.origin),
});

export const buildShareSaveInput = async (input: {
  existingShare: DocumentShare | null;
  documentId: string;
  shareInput: NonNullable<UpdateDocumentSettingsInput["share"]>;
  generateShareId: () => string;
  hashPassword: (password: string, saltBase64?: string | null) => Promise<{
    hash: string;
    salt: string;
    algo: "pbkdf2-sha256";
    iterations: number;
  }>;
}): Promise<SaveDocumentShareInput> => {
  const {existingShare} = input;
  const currentAccessType = existingShare?.accessType || "public";
  const currentDurationType = existingShare?.durationType || "permanent";
  const nextAccessType = input.shareInput.accessType || currentAccessType;
  const nextDurationType = input.shareInput.durationType || currentDurationType;
  const strategyChanged = nextAccessType !== currentAccessType || nextDurationType !== currentDurationType;
  const enabled = input.shareInput.enabled ?? existingShare?.enabled ?? false;
  const listed = resolveListedValue({
    accessType: nextAccessType,
    durationType: nextDurationType,
    currentListed: existingShare?.listed ?? getDefaultListedValue({accessType: currentAccessType, durationType: currentDurationType}),
    requestedListed: input.shareInput.listed,
    strategyChanged,
  });
  const regenerateShareId = Boolean(input.shareInput.regenerateShareId);
  const shareId = regenerateShareId || !existingShare?.shareId ? input.generateShareId() : existingShare.shareId;

  let passwordHash = existingShare?.passwordHash ?? null;
  let passwordSalt = existingShare?.passwordSalt ?? null;
  let passwordAlgo = existingShare?.passwordAlgo ?? null;
  let passwordVersion = existingShare?.passwordVersion ?? null;
  const {password} = input.shareInput;

  if (nextAccessType === "password") {
    if (typeof password === "string" && password.trim()) {
      const derived = await input.hashPassword(password.trim());
      passwordHash = derived.hash;
      passwordSalt = derived.salt;
      passwordAlgo = derived.algo;
      passwordVersion = existingShare?.passwordVersion != null ? existingShare.passwordVersion + 1 : 1;
    } else if (!passwordHash || !passwordSalt) {
      throw new Error("password required for password access");
    }
  } else {
    passwordHash = null;
    passwordSalt = null;
    passwordAlgo = null;
    passwordVersion = null;
  }

  return {
    documentId: input.documentId,
    shareId,
    enabled,
    listed,
    accessType: nextAccessType,
    durationType: nextDurationType,
    startAt: nextDurationType === "range" ? input.shareInput.startAt ?? existingShare?.startAt ?? null : null,
    endAt: nextDurationType === "range" ? input.shareInput.endAt ?? existingShare?.endAt ?? null : null,
    passwordHash,
    passwordSalt,
    passwordAlgo,
    passwordVersion,
    htmlSnapshot: existingShare?.htmlSnapshot ?? null,
    titleSnapshot: existingShare?.titleSnapshot ?? null,
    excerptSnapshot: existingShare?.excerptSnapshot ?? null,
    snapshotVersion: existingShare?.snapshotVersion ?? null,
    snapshotHash: existingShare?.snapshotHash ?? null,
    lastSnapshotAt: existingShare?.lastSnapshotAt ?? null,
  };
};

export const buildMetaUpdateInput = (metaInput?: UpdateDocumentSettingsInput["meta"]): UpdateDocumentMetaInput | null => {
  if (!metaInput) return null;
  const updates: UpdateDocumentMetaInput = {};
  if (typeof metaInput.name === "string") {
    updates.name = metaInput.name;
  }
  if (typeof metaInput.category_id === "string") {
    updates.category_id = metaInput.category_id;
  }
  return Object.keys(updates).length ? updates : null;
};

export const prepareSnapshotUpdate = async (input: {
  existingShare: DocumentShare;
  documentId: string;
  snapshotInput: UpdateShareSnapshotInput;
  sanitizeHtml: (html: string) => Promise<{html: string}>;
}): Promise<{
  saveInput: SaveDocumentShareInput;
  decision: ShareSnapshotUpdateDecision;
}> => {
  const share = input.existingShare;
  if (input.snapshotInput.snapshotVersion == null) {
    throw new Error("snapshotVersion required");
  }
  if (share.snapshotVersion != null && input.snapshotInput.snapshotVersion < share.snapshotVersion) {
    return {
      saveInput: {
        documentId: share.documentId,
        shareId: share.shareId,
        enabled: share.enabled,
        listed: share.listed,
        accessType: share.accessType,
        durationType: share.durationType,
        startAt: share.startAt ?? null,
        endAt: share.endAt ?? null,
        passwordHash: share.passwordHash ?? null,
        passwordSalt: share.passwordSalt ?? null,
        passwordAlgo: share.passwordAlgo ?? null,
        passwordVersion: share.passwordVersion ?? null,
        htmlSnapshot: share.htmlSnapshot ?? null,
        titleSnapshot: share.titleSnapshot ?? null,
        excerptSnapshot: share.excerptSnapshot ?? null,
        snapshotVersion: share.snapshotVersion ?? null,
        snapshotHash: share.snapshotHash ?? null,
        lastSnapshotAt: share.lastSnapshotAt ?? null,
      },
      decision: {
        code: "conflict",
        reason: "older_version",
      },
    };
  }

  const titleSnapshot = normalizeShareSnapshotText(input.snapshotInput.titleSnapshot, 200);
  const excerptSnapshot = normalizeShareSnapshotText(
    input.snapshotInput.excerptSnapshot,
    SHARE_EXCERPT_SNAPSHOT_MAX_CHARS,
  );
  const validationErrors = validateShareSnapshotPayload({
    htmlSnapshot: input.snapshotInput.htmlSnapshot,
    titleSnapshot,
    excerptSnapshot,
  });
  if (validationErrors.length) {
    throw new Error(validationErrors[0]);
  }
  const sanitized = await input.sanitizeHtml(input.snapshotInput.htmlSnapshot);
  const snapshotHash = await computeShareSnapshotHash({
    htmlSnapshot: sanitized.html,
    titleSnapshot,
    excerptSnapshot,
  });
  const decision = evaluateShareSnapshotUpdate({
    currentVersion: share.snapshotVersion ?? null,
    currentHash: share.snapshotHash ?? null,
    incomingVersion: input.snapshotInput.snapshotVersion,
    incomingHash: snapshotHash,
  });

  return {
    saveInput: {
      documentId: input.documentId,
      shareId: share.shareId,
      enabled: share.enabled,
      listed: share.listed,
      accessType: share.accessType,
      durationType: share.durationType,
      startAt: share.startAt ?? null,
      endAt: share.endAt ?? null,
      passwordHash: share.passwordHash ?? null,
      passwordSalt: share.passwordSalt ?? null,
      passwordAlgo: share.passwordAlgo ?? null,
      passwordVersion: share.passwordVersion ?? null,
      htmlSnapshot: sanitized.html,
      titleSnapshot,
      excerptSnapshot,
      snapshotVersion: input.snapshotInput.snapshotVersion,
      snapshotHash,
      lastSnapshotAt: Date.now(),
    },
    decision,
  };
};

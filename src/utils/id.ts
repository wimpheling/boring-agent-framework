let nextFallbackId = 0;

export type IdGenerator = () => string;

export const defaultIdGenerator: IdGenerator = () => {
  const cryptoLike = globalThis.crypto;

  if (cryptoLike && typeof cryptoLike.randomUUID === "function") {
    return cryptoLike.randomUUID();
  }

  nextFallbackId += 1;
  return `baf_${Date.now().toString(36)}_${nextFallbackId.toString(36)}`;
};

export const isoNow = (): string => new Date().toISOString();

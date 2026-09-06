/**
 * Best-effort persistent cache for remote game assets.
 *
 * CacheStorage is intentionally optional: SSR, test fixtures and older
 * embedded browsers simply fall back to the existing in-memory image cache.
 */
const GAME_ASSET_CACHE = "d2-tools-game-assets-v1";

/**
 * Optional namespace for assets originating from a specific Bungie Manifest.
 * Keeping this optional preserves the legacy cache name and call signatures,
 * while callers that know the active Manifest can prevent cross-version
 * icon reuse by passing its version and language.
 */
export type GameAssetCacheNamespace = {
  manifestVersion?: string;
  language?: string;
};

function normalizeNamespacePart(value: string | undefined, fallback: string): string {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

/** Return a stable CacheStorage name for a Manifest/language namespace. */
export function gameAssetCacheName(namespace?: GameAssetCacheNamespace): string {
  if (!namespace?.manifestVersion && !namespace?.language) return GAME_ASSET_CACHE;
  const version = normalizeNamespacePart(namespace.manifestVersion, "unknown");
  const language = normalizeNamespacePart(namespace.language, "default");
  return `${GAME_ASSET_CACHE}-${language}-${version}`;
}

const pendingPersist = new Map<string, Promise<void>>();
const persistedThisSession = new Set<string>();

function canUseCacheStorage() {
  return typeof window !== "undefined" && typeof caches !== "undefined";
}

function isCacheableUrl(src: string) {
  return /^https?:/i.test(src);
}

/** Store an asset response without ever making rendering depend on it. */
export async function persistGameAsset(src: string, namespace?: GameAssetCacheNamespace): Promise<void> {
  if (!canUseCacheStorage() || !isCacheableUrl(src)) return;

  const cacheName = gameAssetCacheName(namespace);
  const pendingKey = `${cacheName}\n${src}`;
  if (persistedThisSession.has(pendingKey)) return;
  const existing = pendingPersist.get(pendingKey);
  if (existing) return existing;

  const task = persistGameAssetInternal(src, cacheName).then((persisted) => {
    if (persisted) persistedThisSession.add(pendingKey);
  });
  pendingPersist.set(pendingKey, task);
  try {
    await task;
  } finally {
    pendingPersist.delete(pendingKey);
  }
}

async function persistGameAssetInternal(src: string, cacheName: string): Promise<boolean> {
  try {
    const cache = await caches.open(cacheName);
    if (await cache.match(src)) return true;

    // CORS responses are safe to persist. Opaque responses cannot be turned
    // back into a usable Blob URL, so leave those to the browser HTTP cache.
    const response = await fetch(src, {
      cache: "force-cache",
      credentials: "omit",
      mode: "cors",
    });
    if (!response.ok || (response.type !== "basic" && response.type !== "cors")) return false;
    await cache.put(src, response.clone());
    return true;
  } catch {
    // CacheStorage is an optimization only; network/CORS/quota failures are
    // deliberately ignored so the normal <img> path remains authoritative.
    return false;
  }
}

/**
 * Resolve a previously persisted asset to a temporary Blob URL.
 * Returns undefined when CacheStorage is unavailable or the response cannot
 * be safely materialized (for example an opaque cross-origin response).
 */
export async function readCachedGameAsset(src: string, namespace?: GameAssetCacheNamespace): Promise<string | undefined> {
  if (!canUseCacheStorage() || !isCacheableUrl(src)) return undefined;

  try {
    const cache = await caches.open(gameAssetCacheName(namespace));
    const response = await cache.match(src);
    if (!response || (response.type !== "basic" && response.type !== "cors")) return undefined;
    const blob = await response.blob();
    if (!blob.size || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
      return undefined;
    }
    return URL.createObjectURL(blob);
  } catch {
    return undefined;
  }
}

export function releaseCachedGameAsset(url: string | undefined) {
  if (!url || !url.startsWith("blob:") || typeof URL === "undefined") return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignore environments with a partial URL implementation (SSR fixtures).
  }
}

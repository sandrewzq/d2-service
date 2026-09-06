import { useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { gameAssetCacheName, persistGameAsset, readCachedGameAsset, releaseCachedGameAsset, type GameAssetCacheNamespace } from "./assetCache.js";

const MAX_RETAINED_GAME_ASSETS = 384;
const retainedGameAssets = new Map<string, HTMLImageElement>();
const pendingGameAssets = new Map<string, HTMLImageElement>();
const loadedGameAssets = new Set<string>();

export type GameAssetImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> & {
  src?: string | null;
  fallback?: ReactNode;
  /** Optional Manifest version/language scope for persistent asset caching. */
  assetNamespace?: GameAssetCacheNamespace;
};

export function GameAssetImage({
  src,
  fallback = null,
  assetNamespace,
  decoding = "async",
  loading = "lazy",
  onLoad,
  ...imageProps
}: GameAssetImageProps) {
  const normalizedSrc = src?.trim() || undefined;
  const namespaceKey = assetNamespace ? `${assetNamespace.language ?? ""}|${assetNamespace.manifestVersion ?? ""}` : "";
  const [failedSrc, setFailedSrc] = useState<string>();
  const [cachedSrc, setCachedSrc] = useState<string>();
  const loadedSrcRef = useRef<string | undefined>(undefined);
  const cachedSourceRef = useRef<string | undefined>(undefined);
  const cachedUrlRef = useRef<string | undefined>(undefined);
  const retainedKey = normalizedSrc ? gameAssetKey(normalizedSrc, assetNamespace) : undefined;
  const wasRetained = retainedKey ? retainedGameAssets.has(retainedKey) : false;

  useEffect(() => {
    setFailedSrc(undefined);
    releaseCachedGameAsset(cachedUrlRef.current);
    cachedUrlRef.current = undefined;
    cachedSourceRef.current = undefined;
    setCachedSrc(undefined);
    loadedSrcRef.current = undefined;
    if (!normalizedSrc) return;

    const wasLoaded = loadedGameAssets.has(gameAssetKey(normalizedSrc, assetNamespace));
    touchRetainedGameAsset(normalizedSrc, assetNamespace);
    if (loading === "eager") preloadGameAsset(normalizedSrc, assetNamespace);
    if (wasLoaded) return;

    let disposed = false;
    void readCachedGameAsset(normalizedSrc, assetNamespace).then((url) => {
      if (!url) return;
      if (disposed || loadedSrcRef.current === normalizedSrc) {
        releaseCachedGameAsset(url);
        return;
      }
      cachedSourceRef.current = normalizedSrc;
      cachedUrlRef.current = url;
      setCachedSrc(url);
    });
    return () => {
      disposed = true;
      if (cachedSourceRef.current === normalizedSrc) {
        releaseCachedGameAsset(cachedUrlRef.current);
        cachedUrlRef.current = undefined;
        cachedSourceRef.current = undefined;
      }
    };
  }, [loading, normalizedSrc, namespaceKey]);

  if (!normalizedSrc || failedSrc === normalizedSrc) {
    return <>{fallback}</>;
  }

  return (
    <img
      {...imageProps}
      src={cachedSourceRef.current === normalizedSrc ? cachedSrc ?? normalizedSrc : normalizedSrc}
      decoding={decoding}
      loading={wasRetained ? "eager" : loading}
      onLoad={(event) => {
        loadedSrcRef.current = normalizedSrc;
        retainGameAsset(normalizedSrc, event.currentTarget, assetNamespace);
        void persistGameAsset(normalizedSrc, assetNamespace);
        onLoad?.(event);
      }}
      onError={() => {
        if (cachedSrc) {
          releaseCachedGameAsset(cachedUrlRef.current);
          cachedUrlRef.current = undefined;
          cachedSourceRef.current = undefined;
          setCachedSrc(undefined);
          return;
        }
        retainedGameAssets.delete(gameAssetKey(normalizedSrc, assetNamespace));
        loadedGameAssets.delete(gameAssetKey(normalizedSrc, assetNamespace));
        pendingGameAssets.delete(`${gameAssetCacheName(assetNamespace)}\n${normalizedSrc}`);
        setFailedSrc(normalizedSrc);
      }}
    />
  );
}

function preloadGameAsset(src: string, namespace?: GameAssetCacheNamespace) {
  const pendingKey = `${gameAssetCacheName(namespace)}\n${src}`;
  if (typeof Image === "undefined" || retainedGameAssets.has(gameAssetKey(src, namespace)) || pendingGameAssets.has(pendingKey)) return;

  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    pendingGameAssets.delete(pendingKey);
    retainGameAsset(src, image, namespace);
    void persistGameAsset(src, namespace);
  };
  image.onerror = () => {
    pendingGameAssets.delete(pendingKey);
  };
  pendingGameAssets.set(pendingKey, image);
  image.src = src;
}

function gameAssetKey(src: string, namespace?: GameAssetCacheNamespace) {
  return `${gameAssetCacheName(namespace)}\n${src}`;
}

function touchRetainedGameAsset(src: string, namespace?: GameAssetCacheNamespace) {
  const key = gameAssetKey(src, namespace);
  const image = retainedGameAssets.get(key);
  if (!image) return;
  retainedGameAssets.delete(key);
  retainedGameAssets.set(key, image);
}

function retainGameAsset(src: string, image: HTMLImageElement, namespace?: GameAssetCacheNamespace) {
  const key = gameAssetKey(src, namespace);
  loadedGameAssets.add(key);
  retainedGameAssets.delete(key);
  retainedGameAssets.set(key, image);

  while (retainedGameAssets.size > MAX_RETAINED_GAME_ASSETS) {
    const oldestSrc = retainedGameAssets.keys().next().value;
    if (typeof oldestSrc !== "string") break;
    retainedGameAssets.delete(oldestSrc);
  }
}

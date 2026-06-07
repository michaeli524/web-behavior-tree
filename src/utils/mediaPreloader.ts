const VIDEO_THUMBNAIL_TIMEOUT_MS = 8000;
const VIDEO_THUMBNAIL_CONCURRENCY = 4;

interface PreloadMediaOptions {
  onProgress?: (loaded: number, total: number) => void;
}

type ThumbnailStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ThumbnailCacheEntry {
  status: ThumbnailStatus;
  url?: string;
  promise?: Promise<string | null>;
}

type ThumbnailCacheListener = (src: string, entry: ThumbnailCacheEntry) => void;

const thumbnailCache = new Map<string, ThumbnailCacheEntry>();
const thumbnailListeners = new Set<ThumbnailCacheListener>();

function emitThumbnailUpdate(src: string, entry: ThumbnailCacheEntry) {
  thumbnailListeners.forEach((listener) => listener(src, entry));
}

function setThumbnailEntry(src: string, entry: ThumbnailCacheEntry) {
  thumbnailCache.set(src, entry);
  emitThumbnailUpdate(src, entry);
}

function cleanupVideo(video: HTMLVideoElement) {
  video.removeAttribute('src');
  video.load();
}

function canvasToObjectUrl(canvas: HTMLCanvasElement): Promise<string | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, 'image/jpeg', 0.82);
  });
}

function captureVideoFrame(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    let settled = false;

    const finish = (url: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleLoadedData);
      video.removeEventListener('error', handleError);
      cleanupVideo(video);
      resolve(url);
    };

    const drawFrame = async () => {
      try {
        const width = video.videoWidth || 160;
        const height = video.videoHeight || 90;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        finish(await canvasToObjectUrl(canvas));
      } catch {
        finish(null);
      }
    };

    const handleLoadedData = () => {
      void drawFrame();
    };

    const handleError = () => finish(null);
    const timeoutId = window.setTimeout(() => finish(null), VIDEO_THUMBNAIL_TIMEOUT_MS);

    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = src;
    video.load();

    video.addEventListener('loadeddata', handleLoadedData, { once: true });
    video.addEventListener('canplay', handleLoadedData, { once: true });
    video.addEventListener('error', handleError, { once: true });
  });
}

export function getVideoThumbnail(src: string): string | undefined {
  return thumbnailCache.get(src)?.url;
}

export function subscribeVideoThumbnails(listener: ThumbnailCacheListener): () => void {
  thumbnailListeners.add(listener);
  return () => thumbnailListeners.delete(listener);
}

export function ensureVideoThumbnail(src: string): Promise<string | null> {
  const existing = thumbnailCache.get(src);
  if (existing?.status === 'ready') return Promise.resolve(existing.url ?? null);
  if (existing?.status === 'error') return Promise.resolve(null);
  if (existing?.promise) return existing.promise;

  const promise = captureVideoFrame(src).then((url) => {
    setThumbnailEntry(src, url ? { status: 'ready', url } : { status: 'error' });
    return url;
  });

  setThumbnailEntry(src, { status: 'loading', promise });
  return promise;
}

export async function preloadVideoThumbnails(srcList: string[], options: PreloadMediaOptions = {}): Promise<void> {
  const uniqueSources = Array.from(new Set(srcList.filter(Boolean)));
  const total = uniqueSources.length;
  if (total === 0) return;

  let loaded = 0;
  let cursor = 0;
  options.onProgress?.(loaded, total);

  const workerCount = Math.min(VIDEO_THUMBNAIL_CONCURRENCY, total);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < total) {
      const src = uniqueSources[cursor];
      cursor += 1;
      await ensureVideoThumbnail(src);
      loaded += 1;
      options.onProgress?.(loaded, total);
    }
  }));
}

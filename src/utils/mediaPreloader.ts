const VIDEO_PRELOAD_TIMEOUT_MS = 6000;
const VIDEO_PRELOAD_CONCURRENCY = 4;

interface PreloadMediaOptions {
  onProgress?: (loaded: number, total: number) => void;
}

function preloadVideoFrame(src: string): Promise<void> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    let settled = false;

    const cleanup = () => {
      video.removeEventListener('loadeddata', handleDone);
      video.removeEventListener('canplay', handleDone);
      video.removeEventListener('error', handleDone);
      video.removeAttribute('src');
      video.load();
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      cleanup();
      resolve();
    };

    const handleDone = () => finish();
    const timeoutId = window.setTimeout(finish, VIDEO_PRELOAD_TIMEOUT_MS);

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = src;
    video.load();

    video.addEventListener('loadeddata', handleDone, { once: true });
    video.addEventListener('canplay', handleDone, { once: true });
    video.addEventListener('error', handleDone, { once: true });
  });
}

export async function preloadVideoFrames(srcList: string[], options: PreloadMediaOptions = {}): Promise<void> {
  const uniqueSources = Array.from(new Set(srcList.filter(Boolean)));
  const total = uniqueSources.length;
  if (total === 0) return;

  let loaded = 0;
  let cursor = 0;
  options.onProgress?.(loaded, total);

  const workerCount = Math.min(VIDEO_PRELOAD_CONCURRENCY, total);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < total) {
      const src = uniqueSources[cursor];
      cursor += 1;
      await preloadVideoFrame(src);
      loaded += 1;
      options.onProgress?.(loaded, total);
    }
  }));
}

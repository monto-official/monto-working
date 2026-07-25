/**
 * Cross-page registry of currently-playing music/story audio elements, so a
 * higher-priority event (a parent's incoming voice message) can pause
 * whatever's playing regardless of which page created it. TTS has its own
 * module-level singleton with its own cancel() (see hooks/useTTS.ts) — this
 * registry only needs to cover the page-local <audio> elements that TTS
 * doesn't know about (songs, stories).
 */
type Pausable = { pause: () => void };

const activeMedia = new Set<Pausable>();

export function registerMedia(media: Pausable) {
  activeMedia.add(media);
}

export function unregisterMedia(media: Pausable) {
  activeMedia.delete(media);
}

export function pauseAllRegisteredMedia() {
  activeMedia.forEach(media => {
    try { media.pause(); } catch { /* already torn down */ }
  });
}

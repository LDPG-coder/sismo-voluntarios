const PHOTO_CHANGED = "sismo:photo-changed";

export function emitPhotoChanged(photoUrl: string | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PHOTO_CHANGED, { detail: { photoUrl } }));
}

export function onPhotoChanged(handler: (photoUrl: string | null) => void) {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent).detail.photoUrl);
  window.addEventListener(PHOTO_CHANGED, listener);
  return () => window.removeEventListener(PHOTO_CHANGED, listener);
}

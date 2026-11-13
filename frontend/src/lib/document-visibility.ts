export function isDocumentVisible(): boolean {
  return document.visibilityState === "visible";
}

export function subscribeDocumentVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return function unsubscribe() {
    document.removeEventListener("visibilitychange", onChange);
  };
}

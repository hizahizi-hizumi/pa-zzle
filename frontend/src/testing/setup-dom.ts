// jsdom does not yet implement the document-level Web Animations API.
// dnd-kit queries running animations when it measures sortable rows.
Object.defineProperty(document, "getAnimations", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Element.prototype, "getAnimations", {
  configurable: true,
  value: () => [],
});

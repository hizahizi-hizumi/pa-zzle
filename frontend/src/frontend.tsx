import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("root element was not found");
}

const root = (import.meta.hot.data.root ??= createRoot(rootElement));
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

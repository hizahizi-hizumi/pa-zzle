import { Routes } from "@generouted/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("#root element not found");
}

// 書体は使われたときに読まれるため、初回表示で使わなかったウェイトは遷移先で遅れて
// 差し替わる。起動時にすべて読み切り、遷移時の字形の差し替わりをなくす。
for (const fontFace of document.fonts) {
  void fontFace.load();
}

createRoot(root).render(
  <StrictMode>
    <Routes />
  </StrictMode>,
);

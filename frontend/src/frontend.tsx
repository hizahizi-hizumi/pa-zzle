import { routes } from "@generouted/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import "@/index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("#root element not found");
}

// 書体は使われたときに読まれるため、初回表示で使わなかったウェイトは遷移先で遅れて
// 差し替わる。切り出したUI書体は起動時にすべて読み切る。後続の Fontsource は
// 全文字分あり、まとめて読むと重いため、使われたときに読ませる。
for (const fontFace of document.fonts) {
  if (
    unquoteFontFamily(fontFace.family) === __PA_ZZLE_UI_FONT_SUBSET_FAMILY__
  ) {
    void fontFace.load();
  }
}

// CSS 由来の FontFace の family は、ブラウザによって引用符付きで返る。
function unquoteFontFamily(family: string): string {
  return family.replace(/^"(.*)"$/, "$1");
}

// 遷移の `flushSync` を使えるよう、generouted の `<Routes />` ではなく react-router/dom の `RouterProvider` で描く。
const router = createBrowserRouter(routes);

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

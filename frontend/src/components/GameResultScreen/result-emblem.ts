import { createContext, type ReactNode } from "react";

/** 結果の「問題選択」の上に添える姿。評価の色を `--result-award-soft` から継いで描く。渡されなければ何も添えない。 */
export const ResultEmblemContext = createContext<ReactNode>(null);

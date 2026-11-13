import { createContext, type ReactNode } from "react";

/**
 * 結果の評価に添える、解いた問題そのものの姿。評価の色（`--result-award-soft`）を継いで描く。
 * 何を添えるかは、問題を集める側（図鑑）が決めて渡す。渡されなければ何も添えない。
 */
export const ResultEmblemContext = createContext<ReactNode>(null);

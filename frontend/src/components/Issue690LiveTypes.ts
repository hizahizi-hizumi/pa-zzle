import type { ReactNode } from "react";
import type { GameResultScoreCriteria } from "@/components/GameResultScreen/GameResultDetails";
import type { GameResultDetailMetric } from "@/components/GameResultScreen/GameResultDetails/DetailMetric";
import type { GameResultMetric } from "@/components/GameResultScreen/ResultMetric";
import type { Issue690BoardSnapshot } from "@/games/issue690-board-snapshot";

export const ISSUE_690_LIVE_IDEAS = [
  { id: "02", title: "文字の舞台" },
  { id: "03", title: "盤面から結果へ" },
  { id: "05", title: "過去を追い越す" },
  { id: "06", title: "空間が変わる" },
  { id: "07", title: "祝う瞬間" },
] as const;

export type Issue690LiveIdea = (typeof ISSUE_690_LIVE_IDEAS)[number]["id"];
export type Issue690LiveSelection = Issue690LiveIdea | "original";

function getIssue690PreviewParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  const debugPath = (window as Window & { __PLAYWRIGHT_PATH__?: string })
    .__PLAYWRIGHT_PATH__;
  const query =
    import.meta.env.DEV && debugPath
      ? (debugPath.split("?")[1] ?? "")
      : window.location.search;
  return new URLSearchParams(query);
}

function isIssue690PreviewHost(hostname: string): boolean {
  return (
    hostname ===
      "research-690-result-experience-redesign-pa-zzle.hizahizihizumi.workers.dev" ||
    /^[0-9a-f]{8}-pa-zzle\.hizahizihizumi\.workers\.dev$/.test(hostname)
  );
}

export function isIssue690LivePreview(): boolean {
  if (typeof window === "undefined") return false;
  return (
    isIssue690PreviewHost(window.location.hostname) ||
    (import.meta.env.DEV && getIssue690PreviewParams().has("issue690Preview"))
  );
}

export const _private = { isIssue690PreviewHost };

export function getIssue690QuerySelection(): Issue690LiveSelection {
  if (typeof window === "undefined") return "original";
  const idea = getIssue690PreviewParams().get("issue690Idea");
  if (idea === "original") return "original";
  return ISSUE_690_LIVE_IDEAS.some((candidate) => candidate.id === idea)
    ? (idea as Issue690LiveIdea)
    : "06";
}

export type Issue690ResultData = {
  gameName: string;
  difficultyLabel: string;
  pictogramSvg: string;
  score: number;
  metrics: readonly GameResultMetric[];
  recordOutcomeNotice: ReactNode;
  issue690RecordSummary?: ReactNode;
  issue690BoardSnapshot?: Issue690BoardSnapshot;
  scoreBreakdown: readonly GameResultDetailMetric[];
  scoreCriteria: GameResultScoreCriteria;
  onStartNewProblem: () => void;
  onReplay?: () => void;
  onOpenGameHome: () => void;
  onOpenDiagnostics?: () => void;
};

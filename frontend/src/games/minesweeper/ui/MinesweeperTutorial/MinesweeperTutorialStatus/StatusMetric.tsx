import { TutorialSpotlight } from "@/components/TutorialSpotlight";

type StatusMetricProps = {
  label: string;
  value: number;
  /** 手を引いている間、次の操作を決める手がかりとして、画面全体の覆いから名前と数を抜く。 */
  spotlit: boolean;
};

/** 本番の見出しの計測値と同じ書式で、名前と数を並べる。 */
export function StatusMetric({ label, value, spotlit }: StatusMetricProps) {
  return (
    <span className="relative flex items-baseline gap-1 whitespace-nowrap">
      <span>{label}</span>
      <span className="min-w-[2ch] text-left font-medium font-mono text-foreground/80 tabular-nums">
        {value}
      </span>
      {/* 名前と数の並びの形のまま、覆いのための余白を足さずに抜く。 */}
      <TutorialSpotlight active={spotlit} className="inset-0" />
    </span>
  );
}

import { Button } from "@/components/ui/button";

type ReflectionClearedPanelProps = {
  difficultyLabel: string;
  onReplay: () => void;
  onStartNewProblem: () => void;
};

/** 結果画面を導入するまで、揃った盤面の上に次の行動を置く仮表示。 */
export function ReflectionClearedPanel({
  difficultyLabel,
  onReplay,
  onStartNewProblem,
}: ReflectionClearedPanelProps) {
  return (
    <div
      role="status"
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/80 p-4 animate-in fade-in duration-(--duration-slow) motion-reduce:animate-none"
    >
      <div className="flex flex-col items-center gap-1">
        <strong className="text-screen-title">完成！</strong>
        <span className="text-meta text-muted-foreground">
          {difficultyLabel}
        </span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="secondary" onClick={onReplay}>
          同じ問題をもう一度
        </Button>
        <Button type="button" onClick={onStartNewProblem}>
          別の問題
        </Button>
      </div>
    </div>
  );
}

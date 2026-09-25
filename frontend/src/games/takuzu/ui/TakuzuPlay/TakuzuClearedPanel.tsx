import { Button } from "@/components/ui/button";

type TakuzuClearedPanelProps = {
  onReplay: () => void;
  onStartNewProblem?: () => void;
};

/** 結果画面を導入するまで、完成した盤面の上に次の行動を置く仮表示。 */
export function TakuzuClearedPanel({
  onReplay,
  onStartNewProblem,
}: TakuzuClearedPanelProps) {
  return (
    <div
      role="status"
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[2.5%] bg-background/80 p-4 animate-in fade-in duration-slow motion-reduce:animate-none"
    >
      <strong className="text-screen-title">完成！</strong>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="secondary" onClick={onReplay}>
          同じ問題をもう一度
        </Button>
        {onStartNewProblem && (
          <Button type="button" onClick={onStartNewProblem}>
            別の問題
          </Button>
        )}
      </div>
    </div>
  );
}

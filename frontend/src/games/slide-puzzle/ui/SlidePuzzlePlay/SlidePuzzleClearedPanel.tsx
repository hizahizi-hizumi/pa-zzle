import { Button } from "@/components/ui/button";

type SlidePuzzleClearedPanelProps = {
  onReplay: () => void;
  onStartNewProblem: () => void;
};

export function SlidePuzzleClearedPanel({
  onReplay,
  onStartNewProblem,
}: SlidePuzzleClearedPanelProps) {
  return (
    <div role="status" className="flex flex-col items-center gap-3">
      <strong className="text-heading">完成！</strong>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onReplay}>
          同じ問題をもう一度
        </Button>
        <Button onClick={onStartNewProblem}>別の問題</Button>
      </div>
    </div>
  );
}

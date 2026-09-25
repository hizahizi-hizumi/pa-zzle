import { Button } from "@/components/ui/button";

type TakuzuClearedPanelProps = {
  onReplay: () => void;
};

export function TakuzuClearedPanel({ onReplay }: TakuzuClearedPanelProps) {
  return (
    <div role="status" className="flex flex-col items-center gap-3">
      <strong className="text-heading">完成！</strong>
      <Button variant="secondary" onClick={onReplay}>
        同じ問題をもう一度
      </Button>
    </div>
  );
}

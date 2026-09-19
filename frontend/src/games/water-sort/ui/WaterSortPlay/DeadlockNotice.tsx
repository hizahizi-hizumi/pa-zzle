import { RotateCcw, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type DeadlockNoticeProps = {
  canUndo: boolean;
  onUndo: () => void;
  onRestart: () => void;
};

export function DeadlockNotice({
  canUndo,
  onUndo,
  onRestart,
}: DeadlockNoticeProps) {
  return (
    <div
      role="status"
      className="mx-auto max-w-md rounded-xl border bg-muted/50 px-3 py-2"
    >
      <div className="text-center">
        <p className="text-sm font-semibold">手詰まり</p>
      </div>
      <div className="mt-1 flex justify-center gap-1">
        <Button
          type="button"
          variant="outline"
          onClick={onUndo}
          disabled={!canUndo}
        >
          <Undo2 />
          待った
        </Button>
        <Button type="button" variant="outline" onClick={onRestart}>
          <RotateCcw />
          最初から
        </Button>
      </div>
    </div>
  );
}

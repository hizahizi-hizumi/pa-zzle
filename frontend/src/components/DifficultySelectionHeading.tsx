import { CircleHelp } from "lucide-react";
import { type ReactNode, useState } from "react";

import type { HowToPlayDialogControl } from "@/components/HowToPlayDialog";
import { Button } from "@/components/ui/button";

type DifficultySelectionHeadingProps = {
  title: string;
  /** ゲーム固有の遊び方ダイアログを描く。開閉の状態は見出しが持ち、引数で渡す。 */
  renderHowToPlayDialog: (control: HowToPlayDialogControl) => ReactNode;
};

/** 難易度選択画面の見出しとして、ゲーム名と遊び方を開く入口を並べる。 */
export function DifficultySelectionHeading({
  title,
  renderHowToPlayDialog,
}: DifficultySelectionHeadingProps) {
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-screen-title">{title}</h1>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setHowToPlayOpen(true)}
      >
        <CircleHelp />
        遊び方
      </Button>
      {renderHowToPlayDialog({
        open: howToPlayOpen,
        onClose: () => setHowToPlayOpen(false),
      })}
    </div>
  );
}

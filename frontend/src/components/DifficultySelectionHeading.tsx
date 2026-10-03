import { CircleHelp, Pointer } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type OpenControl = {
  open: boolean;
  onClose: () => void;
};

type DifficultySelectionHeadingProps = {
  title: string;
  /** ゲーム固有の遊び方ダイアログを描く。開閉の状態は見出しが持ち、引数で渡す。 */
  renderHowToPlayDialog: (control: OpenControl) => ReactNode;
  /**
   * ゲーム固有のチュートリアルを描く。開閉の状態は見出しが持ち、引数で渡す。
   * 省略すると、チュートリアルを開く入口を出さない。
   */
  renderTutorial?: (control: OpenControl) => ReactNode;
};

/** 難易度選択画面の見出しとして、ゲーム名と、遊び方・チュートリアルを開く入口を並べる。 */
export function DifficultySelectionHeading({
  title,
  renderHowToPlayDialog,
  renderTutorial,
}: DifficultySelectionHeadingProps) {
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  return (
    // 入口が2つ並ぶと狭い幅でゲーム名が折り返すので、ゲーム名を1行に保ち、入口を次の行へ送る。
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        renderTutorial && "flex-wrap gap-y-1",
      )}
    >
      <h1 className="text-screen-title">{title}</h1>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setHowToPlayOpen(true)}
        >
          <CircleHelp />
          遊び方
        </Button>
        {renderTutorial && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTutorialOpen(true)}
          >
            <Pointer />
            チュートリアル
          </Button>
        )}
      </div>
      {renderHowToPlayDialog({
        open: howToPlayOpen,
        onClose: () => setHowToPlayOpen(false),
      })}
      {renderTutorial?.({
        open: tutorialOpen,
        onClose: () => setTutorialOpen(false),
      })}
    </div>
  );
}

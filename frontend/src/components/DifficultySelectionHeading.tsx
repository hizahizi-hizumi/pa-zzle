import { BookOpen, CircleHelp } from "lucide-react";
import { type ReactNode, useState } from "react";

import type { HowToPlayDialogControl } from "@/components/HowToPlayDialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/router";

type DifficultySelectionHeadingProps = {
  title: string;
  /** 図鑑を開くゲームの ID（記録の `gameId`）。 */
  gameId: string;
  /** ゲーム固有の遊び方ダイアログを描く。開閉の状態は見出しが持ち、引数で渡す。 */
  renderHowToPlayDialog: (control: HowToPlayDialogControl) => ReactNode;
};

/** 難易度選択画面の見出しとして、ゲーム名と、遊び方・図鑑を開く入口を並べる。 */
export function DifficultySelectionHeading({
  title,
  gameId,
  renderHowToPlayDialog,
}: DifficultySelectionHeadingProps) {
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  return (
    // 狭い画面でゲーム名を途中で折り返さないよう、入口が収まらなければ入口を次の行へ送る。
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
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
        <Button asChild variant="ghost" size="sm">
          <Link to="/puzzles/:game/zukan" params={{ game: gameId }}>
            <BookOpen />
            図鑑
          </Link>
        </Button>
      </div>
      {renderHowToPlayDialog({
        open: howToPlayOpen,
        onClose: () => setHowToPlayOpen(false),
      })}
    </div>
  );
}

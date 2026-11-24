import { UndoButton } from "@/components/UndoButton";
import { SolitaireStuckNotice } from "@/games/solitaire/ui/SolitairePlay/SolitaireStuckNotice";
import { solitaireToneClassNames } from "@/games/solitaire/ui/solitaire-tone";
import { cn } from "@/lib/utils";

function ignoreFigurePress() {}

/**
 * プレイ画面の下の帯と同じく、待ったの丸の左に状態の知らせを1行で並べた、押しても何も起きない静止の図。
 * 知らせの言葉は卓の地の上に出るので、プレイ画面と同じ卓の地の上に置く。
 */
export function StuckNoticeFigure() {
  return (
    // 押せない1枚の絵として、読み上げでは名前だけを伝える。
    <div role="img" aria-label="盤面の下に出る知らせ">
      <span
        aria-hidden="true"
        inert
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2",
          solitaireToneClassNames.ground,
        )}
      >
        <SolitaireStuckNotice />
        <UndoButton disabled={false} onUndo={ignoreFigurePress} />
      </span>
    </div>
  );
}

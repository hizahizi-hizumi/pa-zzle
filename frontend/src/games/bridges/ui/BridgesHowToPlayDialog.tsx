import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { HowToPlayTransition } from "@/components/HowToPlayTransition";
import { parseBridgesBoard } from "@/games/bridges/puzzle/board";
import { HowToPlayFigure } from "@/games/bridges/ui/BridgesHowToPlayDialog/HowToPlayFigure";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type BridgesHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * 図を小さな盤面にして、島の数字を読める大きさに描く。
 * 3 . 3     辺0 = 左上-右上、辺1 = 左上-左下、辺2 = 右上-右下、辺3 = 左下-右下
 * . . .
 * 2 . 2
 */
const squareBoard = parseBridgesBoard(["3.3", "...", "2.2"]);
/**
 * 辺0 = 上-下（縦）、辺1 = 左-右（横）。2辺は真ん中で交わる。
 * . 1 .
 * 1 . 1
 * . 1 .
 */
const crossBoard = parseBridgesBoard([".1.", "1.1", ".1."]);

export function BridgesHowToPlayDialog({
  open,
  onClose,
}: BridgesHowToPlayDialogProps) {
  return (
    <HowToPlayDialog
      open={open}
      description="島と島の間に橋を架け、どの島も数字と同じ本数の橋が出ていて、全部の島が1つにつながるようにする。"
      onClose={onClose}
    >
      <li className="space-y-2">
        <p>
          橋は縦か横にまっすぐ、間に島の無い2つの島の間に架ける。同じ2島の間は2本まで。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure board={squareBoard} bridges={[0, 0, 0, 0]} />
          <HowToPlayFigure board={squareBoard} bridges={[2, 1, 1, 1]} />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          島と島の間を押して離すたびに、橋が 1本 → 2本 → なし
          と変わる。押している間は変わる橋が光り、指をずらして離すと取り消せる。島を押してから相手の島を押しても、島から相手の島へなぞっても同じに変わる。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure
            board={squareBoard}
            bridges={[0, 0, 0, 0]}
            finger={{ x: 1.5, y: 0.5 }}
          />
          <HowToPlayFigure board={squareBoard} bridges={[1, 0, 0, 0]} />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          橋どうしは交差しない。架かった橋をまたいで架けようとすると、邪魔をしている橋が赤く縁取られて揺れる。交わる所のすぐそばのように、2本の線から同じくらい離れた所を押すと、どちらの橋も変えずに2つの組を示すので、島から選んで架ける。
        </p>
        <HowToPlayFigure
          board={crossBoard}
          bridges={[0, 1]}
          blockingEdges={[1]}
          blockedAttempt={{ edge: 0, island: 0 }}
          finger={{ x: 1.5, y: 1.15 }}
        />
      </li>
      <li className="space-y-2">
        <p>橋の本数が数字と同じになった島は緑に、多すぎる島は赤くなる。</p>
        <HowToPlayFigure board={squareBoard} bridges={[2, 2, 1, 0]} />
      </li>
      <li>{PLAY_OPERATION_LABELS.undo}は、橋を変えた操作を1つずつ取り消す。</li>
      <li className="hidden pointer-fine:list-item">
        <p className="text-muted-foreground">
          マウス: 右クリックで、橋を逆に なし → 2本 → 1本 と変える。Esc
          で島の選びを解く。キーボード:
          盤面の島を選び、矢印キーで隣の島へ移る。Shift
          と矢印キーで、その向きの橋を 1本 → 2本 → なしと変える。
        </p>
      </li>
    </HowToPlayDialog>
  );
}

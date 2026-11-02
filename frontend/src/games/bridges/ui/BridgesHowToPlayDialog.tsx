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
 * 図の島（5×5）
 * 3 . . . 3     辺0 = 左上-右上、辺1 = 左上-左下、辺2 = 右上-右下、辺3 = 左下-右下
 * . . . . .
 * . . . . .
 * . . . . .
 * 2 . . . 2
 */
const squareBoard = parseBridgesBoard([
  "3...3",
  ".....",
  ".....",
  ".....",
  "2...2",
]);
/**
 * 辺0 = 上-下（縦）、辺1 = 左-右（横）。2辺は真ん中で交わる。
 * . . 1 . .
 * . . . . .
 * 1 . . . 1
 * . . . . .
 * . . 1 . .
 */
const crossBoard = parseBridgesBoard([
  "..1..",
  ".....",
  "1...1",
  ".....",
  "..1..",
]);

/**
 * ルールと操作を、盤面と同じ見た目の小さな図と短い一文で示す。
 * 最初に完成の形（数字と同じ本数・全島がつながる）を置き、押す・なぞる・交わる所・島の色の順に並べる。
 */
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
          島と島の間を押すと橋が1本架かる。押すたびに 1本 → 2本 →
          なしと変わり、2本を1本にするときは、なしを経て1本にする。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure
            board={squareBoard}
            bridges={[0, 0, 0, 0]}
            finger={{ x: 2.5, y: 0.5 }}
          />
          <HowToPlayFigure board={squareBoard} bridges={[1, 0, 0, 0]} />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          島を押すと、橋を架けられる相手へ線が出る。そのまま相手の島へなぞって離しても、橋が同じに変わる。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure
            board={squareBoard}
            bridges={[0, 0, 0, 0]}
            guide={{ edges: [0, 1], previewEdge: 1 }}
            finger={{ x: 0.5, y: 3 }}
          />
          <HowToPlayFigure board={squareBoard} bridges={[0, 1, 0, 0]} />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          橋どうしは交差しない。交わる所に架けようとすると、邪魔をしている橋が赤く光る。交わる所の近くは、なぞると狙った2島の間に確実に架けられる。
        </p>
        <HowToPlayFigure
          board={crossBoard}
          bridges={[0, 1]}
          blockingEdges={[1]}
          finger={{ x: 2.5, y: 1.5 }}
        />
      </li>
      <li className="space-y-2">
        <p>
          橋の本数が数字と同じになった島は灰色に、多すぎる島は赤くなる。全部の島がつながって完成すると、島が順に跳ねる。
        </p>
        <HowToPlayFigure board={squareBoard} bridges={[2, 2, 1, 0]} />
      </li>
      <li>{PLAY_OPERATION_LABELS.undo}は、橋を変えた操作を1つずつ取り消す。</li>
      <li className="hidden pointer-fine:list-item">
        <p className="text-muted-foreground">
          キーボード: 盤面の島を選び、矢印キーで隣の島へ移る。Shift
          と矢印キーで、その向きの橋を 1本 → 2本 → なしと変える。
        </p>
      </li>
    </HowToPlayDialog>
  );
}

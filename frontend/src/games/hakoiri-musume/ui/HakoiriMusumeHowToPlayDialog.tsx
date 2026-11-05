import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { HowToPlayTransition } from "@/components/HowToPlayTransition";
import { parseHakoiriMusumeBoard } from "@/games/hakoiri-musume/puzzle/board";
import { HowToPlayFigure } from "@/games/hakoiri-musume/ui/HakoiriMusumeHowToPlayDialog/HowToPlayFigure";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type HakoiriMusumeHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

/** 小駒を下へなぞってから左へ曲がり、1手で運ぶ前と後。駒の番号 4 が真ん中の小駒。 */
const turnBeforeBoard = parseHakoiriMusumeBoard("vAAvwAAwv.svw..whi.s")!;
const turnAfterBoard = parseHakoiriMusumeBoard("vAAvwAAwv..vws.whi.s")!;
/** 左下の小駒（駒の番号 6）を右へ1マスずつ、2回に分けてなぞる。 */
const twoStrokesBoards = [
  parseHakoiriMusumeBoard("vAAvwAAwv..vwhiws..s")!,
  parseHakoiriMusumeBoard("vAAvwAAwv..vwhiw.s.s")!,
  parseHakoiriMusumeBoard("vAAvwAAwv..vwhiw..ss")!,
] as const;
/** 娘が出口の1段上から下りて、出口の前に着く前と後。駒の番号 4 が娘。 */
const beforeExitBoard = parseHakoiriMusumeBoard("v..vwssw.AAv.AAws..s")!;
const clearedBoard = parseHakoiriMusumeBoard("v..vwssw...v.AAwsAAs")!;

/** ルールと操作を、盤面と同じ見た目の小さな図と短い一文で示す。 */
export function HakoiriMusumeHowToPlayDialog({
  open,
  onClose,
}: HakoiriMusumeHowToPlayDialogProps) {
  return (
    <HowToPlayDialog
      open={open}
      description="駒をすべらせて道を空け、朱い娘の駒を下の出口の前まで運ぶ。"
      onClose={onClose}
    >
      <li className="space-y-2">
        <p>
          駒を指でなぞると、空いたマスへ1マスずつすべる。なぞったまま角を曲がってもよい。ほかの駒を飛び越えたり、押しのけたりはしない。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure
            pieces={turnBeforeBoard}
            trace={{ pieceIndex: 4, cells: [10, 14, 13] }}
          />
          <HowToPlayFigure pieces={turnAfterBoard} />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          同じ駒を続けて動かす間は、指を離してなぞり直しても1手と数える。別の駒を動かすと次の1手になる。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure
            pieces={twoStrokesBoards[0]}
            trace={{ pieceIndex: 6, cells: [16, 17] }}
          />
          <HowToPlayFigure
            pieces={twoStrokesBoards[1]}
            trace={{ pieceIndex: 6, cells: [17, 18] }}
          />
          <HowToPlayFigure pieces={twoStrokesBoards[2]} />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          娘が下の縁の切り欠き（出口）の前に着けば完成。どんな道順でもよいが、手数が少ないほど点が高い。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure
            pieces={beforeExitBoard}
            trace={{ pieceIndex: 4, cells: [9, 13] }}
          />
          <HowToPlayFigure pieces={clearedBoard} />
        </HowToPlayTransition>
      </li>
      <li>
        <p>
          {PLAY_OPERATION_LABELS.undo}は1手ずつ取り消す。取り消しても、
          {PLAY_OPERATION_LABELS.restart}
          で始めの並びに戻しても、手数は減らない。
        </p>
      </li>
      <li className="hidden pointer-fine:list-item">
        <p className="text-muted-foreground">
          キーボード: Tab で駒を選び、矢印キーでその向きへ1マス動かす。
        </p>
      </li>
    </HowToPlayDialog>
  );
}

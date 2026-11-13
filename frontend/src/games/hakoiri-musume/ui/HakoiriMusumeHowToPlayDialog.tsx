import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { HowToPlayTransition } from "@/components/HowToPlayTransition";
import { parseHakoiriMusumeClassicBoard } from "@/games/hakoiri-musume/puzzle/classic-board";
import { HowToPlayFigure } from "@/games/hakoiri-musume/ui/HakoiriMusumeHowToPlayDialog/HowToPlayFigure";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type HakoiriMusumeHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

/** 小駒を下へなぞってから左へ曲がり、1手で運ぶ前と後。駒の番号 4 が真ん中の小駒。 */
const turnBeforeBoard = parseHakoiriMusumeClassicBoard("vAAvwAAwv.svw..whi.s")!;
const turnAfterBoard = parseHakoiriMusumeClassicBoard("vAAvwAAwv..vws.whi.s")!;
/** 左下の小駒（駒の番号 6）を右へ1マスずつ、2回に分けてなぞる。 */
const twoStrokesBoards = [
  parseHakoiriMusumeClassicBoard("vAAvwAAwv..vwhiws..s")!,
  parseHakoiriMusumeClassicBoard("vAAvwAAwv..vwhiw.s.s")!,
  parseHakoiriMusumeClassicBoard("vAAvwAAwv..vwhiw..ss")!,
] as const;
/** 娘が出口の1段上から下りて、出口の前に着く前と後。駒の番号 4 が娘。 */
const beforeExitBoard = parseHakoiriMusumeClassicBoard("v..vwssw.AAv.AAws..s")!;
const clearedBoard = parseHakoiriMusumeClassicBoard("v..vwssw...v.AAwsAAs")!;

export function HakoiriMusumeHowToPlayDialog({
  open,
  onClose,
}: HakoiriMusumeHowToPlayDialogProps) {
  return (
    <HowToPlayDialog
      open={open}
      description="駒をよけて道を空け、娘を出口の前へ運ぶ。"
      onClose={onClose}
    >
      <li className="space-y-2">
        <p>
          駒を指でなぞると、空いたマスへすべる。なぞったまま角を曲がれ、軽く弾いても1マス動く。ほかの駒は通り抜けられない。
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
        <p>同じ駒を続けて動かす間は、指を離しても1手。駒を替えると次の1手。</p>
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
        <p>娘が出口の前に着けば完成。少ない手数で速く解くほど点が高い。</p>
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
          マウスでは駒を押したまま引く。キーボードでは Tab
          で駒を選び、矢印キーでその向きへ1マス動かす。
        </p>
      </li>
    </HowToPlayDialog>
  );
}

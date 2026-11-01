import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { HowToPlayTransition } from "@/components/HowToPlayTransition";
import { parseHitofudePuzzleBoard } from "@/games/hitofude-puzzle/puzzle/board";
import { HowToPlayFigure } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/HowToPlayFigure";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type HitofudePuzzleHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * 図のマス番号（3×3）
 * 0 1 2
 * 3 4 5
 * 6 7 8
 */
const openBoard = parseHitofudePuzzleBoard(["S . .", ". . .", ". . ."]);
/** 真ん中に穴が開き、右下の角が欠けた盤面。 */
const holedBoard = parseHitofudePuzzleBoard(["S . .", ". # .", ". . #"]);

/**
 * ルールと操作を、盤面と同じ見た目の小さな図と短い一文で示す。
 * 最初に、なぞって全マスを1回ずつ通ること、穴は通らないことを置き、戻す操作は1か所にまとめる。
 */
export function HitofudePuzzleHowToPlayDialog({
  open,
  onClose,
}: HitofudePuzzleHowToPlayDialogProps) {
  return (
    <HowToPlayDialog
      open={open}
      description="丸い印のマスから、すべてのマスを1回ずつ通る1本の道を引く。"
      onClose={onClose}
    >
      <li className="space-y-2">
        <p>
          輪の付いた先端から、上下左右の隣のマスへ指でなぞって道を延ばす。同じマスは2回通れない。すべてのマスを通れば完成。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure board={openBoard} path={[0]} fingerCell={0} />
          <HowToPlayFigure
            board={openBoard}
            path={[0, 1, 2, 5, 4, 3, 6, 7, 8]}
          />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          穴（盤面に開いた穴や、縁の欠けた所）は通らない。進もうとすると×が出る。
        </p>
        <HowToPlayFigure
          board={holedBoard}
          path={[0, 1, 2, 5]}
          blockedCell={8}
          fingerCell={8}
        />
      </li>
      <li className="space-y-2">
        <p>
          戻すときは、1つ前のマスへなぞり戻すか、道の途中のマスを押す。押したままなぞると、そこから引き直せる。
          {PLAY_OPERATION_LABELS.undo}は、なぞり1回ずつを取り消す。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure
            board={openBoard}
            path={[0, 1, 2, 5, 4]}
            fingerCell={1}
          />
          <HowToPlayFigure board={openBoard} path={[0, 1]} fingerCell={1} />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          進めるマスが無くなると、先端が行き止まりの印（横棒の入った丸）に変わる。戻して引き直す。
        </p>
        <HowToPlayFigure board={openBoard} path={[0, 1, 4, 5, 2]} isDeadEnd />
      </li>
      <li className="hidden pointer-fine:list-item">
        <p className="text-muted-foreground">
          キーボード:
          矢印キーで先端からその向きへ1マス延ばし、来た向きで1マス縮める（盤面を選ばなくても効く）。Shift
          と矢印キーでマスを選び、Enter で押せる。
        </p>
      </li>
    </HowToPlayDialog>
  );
}

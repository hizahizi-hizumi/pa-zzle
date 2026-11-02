import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { HowToPlayTransition } from "@/components/HowToPlayTransition";
import { difficultyLevels } from "@/games/difficulty";
import type { HamiltonianPathDifficulty } from "@/games/hamiltonian-path/difficulty";
import {
  listHamiltonianPathStrandedCells,
  showsHamiltonianPathStranding,
} from "@/games/hamiltonian-path/play/stranding-notice";
import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";
import { HowToPlayFigure } from "@/games/hamiltonian-path/ui/HamiltonianPathHowToPlayDialog/HowToPlayFigure";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type HamiltonianPathHowToPlayDialogProps = {
  open: boolean;
  /**
   * 遊んでいる難易度。渡すと、その難易度で取り残しを知らせるときだけ説明する。
   * 難易度を選ぶ前は、取り残しを知らせるレベルを添えて説明する。
   */
  difficulty?: HamiltonianPathDifficulty;
  onClose: () => void;
};

/**
 * 図のマス番号（3×3）
 * 0 1 2
 * 3 4 5
 * 6 7 8
 */
const openBoard = parseHamiltonianPathBoard([
  "S . .",
  "",
  ". . .",
  "",
  ". . .",
]);
const blockedBoard = parseHamiltonianPathBoard([
  "S .|.",
  "",
  ". # .",
  "",
  ". . .",
]);

/** ルールと操作を、盤面と同じ見た目の小さな図と短い一文で示す。 */
/** 真ん中の列を縦に通って、左右の列が両方とも端になれなくなった道。 */
const strandingPath = [0, 1, 4, 7];

function describeStrandingLevels(): string {
  const levels = difficultyLevels
    .map((level) => level.id)
    .filter(showsHamiltonianPathStranding);
  return `レベル${levels[0]}〜${levels.at(-1)}`;
}

function describeStrandingScope(
  difficulty: HamiltonianPathDifficulty | undefined,
): string | null {
  if (difficulty === undefined) {
    return describeStrandingLevels();
  }
  return showsHamiltonianPathStranding(difficulty) ? "このレベル" : null;
}

export function HamiltonianPathHowToPlayDialog({
  open,
  difficulty,
  onClose,
}: HamiltonianPathHowToPlayDialogProps) {
  const strandingScope = describeStrandingScope(difficulty);

  return (
    <HowToPlayDialog
      open={open}
      description="丸い印のマスから、すべてのマスを1回ずつ通る1本の道を引く。"
      onClose={onClose}
    >
      <li className="space-y-2">
        <p>
          道は上下左右に隣り合うマスへ進む。同じマスは2回通れない。すべてのマスを通れば完成。
        </p>
        <HowToPlayFigure board={openBoard} path={[0, 1, 2, 5, 4, 3, 6, 7, 8]} />
      </li>
      <li className="space-y-2">
        <p>
          壁（暗いマス）と仕切り（マスの間の短い棒）の向こうへは進めない。進もうとすると、そのマスに×が出る。
        </p>
        <div className="flex items-center gap-2">
          <HowToPlayFigure
            board={blockedBoard}
            path={[0, 1]}
            blockedCell={2}
            fingerCell={2}
          />
          <HowToPlayFigure
            board={blockedBoard}
            path={[0, 1]}
            blockedCell={4}
            fingerCell={4}
          />
        </div>
      </li>
      <li className="space-y-2">
        <p>
          輪の付いた道の先端から指でなぞると、道が延びる。1つ前のマスへ戻ると1マス縮む。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure board={openBoard} path={[0]} fingerCell={0} />
          <HowToPlayFigure
            board={openBoard}
            path={[0, 1, 2, 5]}
            fingerCell={5}
          />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          道の途中のマスを押すと、そこまで道が戻る。押したままなぞると、そこから引き直せる。
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
      <li>
        <p>先端の隣のマスを押すだけでも、1マスずつ延ばせる。</p>
      </li>
      <li className="space-y-2">
        <p>
          先端から進めるマスが無くなると、先端の輪が欠ける。道のマスを押すか
          {PLAY_OPERATION_LABELS.undo}で戻して引き直す。
        </p>
        <HowToPlayFigure board={openBoard} path={[0, 1, 4, 5, 2]} isDeadEnd />
      </li>
      {strandingScope === null ? null : (
        <li className="space-y-2">
          <p>
            {strandingScope}
            では、今の道のままではもう通りきれないマスに斜線が付く。
          </p>
          <HowToPlayFigure
            board={openBoard}
            path={strandingPath}
            strandedCells={listHamiltonianPathStrandedCells(
              openBoard,
              strandingPath,
            )}
          />
        </li>
      )}
      <li>
        <p>
          {PLAY_OPERATION_LABELS.undo}
          は、押してから離すまでのなぞり1回ずつを取り消す。
        </p>
      </li>
      <li className="hidden pointer-fine:list-item">
        <p className="text-muted-foreground">
          キーボード:
          矢印キーで、先端からその向きへ1マス延ばす。来た向きへ押すと1マス縮む。Shift
          と矢印キーでマスを選び、Enter で押せる。
        </p>
      </li>
    </HowToPlayDialog>
  );
}

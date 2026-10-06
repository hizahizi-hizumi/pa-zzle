import { useEffect, useMemo, useRef } from "react";

import { GamePlayFrame } from "@/components/GamePlayFrame";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
} from "@/games/play";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import type { ReflectionLaserPathMode } from "@/games/reflection/laser-path-mode";
import type {
  ReflectionLaserView,
  ReflectionResult,
} from "@/games/reflection/play/use-reflection-play";
import type {
  ReflectionBoard as ReflectionBoardState,
  ReflectionInventory,
  ReflectionPiece,
} from "@/games/reflection/puzzle/board";
import type {
  ReflectionClue,
  ReflectionEntry,
} from "@/games/reflection/puzzle/laser";
import { listReflectionClueMatches } from "@/games/reflection/puzzle/rules";
import type { ReflectionSelection } from "@/games/reflection/session/session";
import { ReflectionBoard } from "@/games/reflection/ui/board/ReflectionBoard";
import { ReflectionHowToPlayDialog } from "@/games/reflection/ui/ReflectionHowToPlayDialog";
import {
  listReflectionStockPieces,
  ReflectionStock,
} from "@/games/reflection/ui/ReflectionPlay/ReflectionStock";
import { ReflectionResultScreen } from "@/games/reflection/ui/result/ReflectionResultScreen";

type ReflectionPlayProps = GamePlayScreenProps<
  ReflectionDifficulty,
  ReflectionResult
> &
  RestartableGamePlayScreenProps & {
    laserPathMode: ReflectionLaserPathMode;
    board: ReflectionBoardState;
    clues: readonly ReflectionClue[];
    inventory: ReflectionInventory;
    stock: ReflectionInventory;
    selection: ReflectionSelection | null;
    laser: ReflectionLaserView | null;
    onSelectCell: (cellIndex: number) => void;
    onSelectStockPiece: (piece: ReflectionPiece) => void;
    onSelectClue: (entry: ReflectionEntry) => void;
    onRemovePiece: (cellIndex: number) => void;
    onClearSelection: () => void;
  };

/** 数字キーの `1` から順に、ストックに並ぶ種類を選ぶ。 */
function getStockKeyIndex(key: string): number | null {
  return /^[1-9]$/.test(key) ? Number(key) - 1 : null;
}

export function ReflectionPlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordOutcomeNotice,
  laserPathMode,
  board,
  clues,
  inventory,
  stock,
  selection,
  laser,
  canRestart,
  onSelectCell,
  onSelectStockPiece,
  onSelectClue,
  onRemovePiece,
  onClearSelection,
  onRestart,
  onReplay,
  onClearAnimationComplete,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: ReflectionPlayProps) {
  const playing = progress === "playing";
  const clueMatches = useMemo(
    () => listReflectionClueMatches(board, clues),
    [board, clues],
  );
  const playAreaRef = useRef<HTMLElement>(null);

  // 数字キーと Esc は盤面のどこにフォーカスがあっても効かせる。クリックでボタンへフォーカスが移らないブラウザや、
  // 開いた直後のようにフォーカスが body にある場合も受けるため、window で受ける。
  useEffect(() => {
    if (!playing) return;

    function handleKeyDown(event: KeyboardEvent): void {
      // メニューやダイアログはプレイ画面の外へ描かれる。そこでの操作は盤面へ流さない。
      const { target } = event;
      const targetsPlayArea =
        target === document.body ||
        (target instanceof Node && playAreaRef.current?.contains(target));
      if (
        !targetsPlayArea ||
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      if (event.key === "Escape") {
        onClearSelection();
        return;
      }

      const stockIndex = getStockKeyIndex(event.key);
      const piece =
        stockIndex === null
          ? undefined
          : listReflectionStockPieces(inventory)[stockIndex];
      if (piece) {
        event.preventDefault();
        onSelectStockPiece(piece);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playing, inventory, onClearSelection, onSelectStockPiece]);

  return (
    <GamePlayFrame
      ref={playAreaRef}
      progress={progress}
      result={result}
      title={REFLECTION_DISPLAY_NAME}
      // 置き直しは点に入らないので、プレイ中は時間だけを示す。置き直しの回数は結果と記録に出す。
      metrics={[{ type: "elapsed-time", elapsedMs }]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <ReflectionHowToPlayDialog
          open={open}
          laserPathMode={laserPathMode}
          onClose={onClose}
        />
      )}
      renderResultScreen={(clearedResult) => (
        <ReflectionResultScreen
          difficulty={difficulty}
          laserPathMode={laserPathMode}
          result={clearedResult}
          recordOutcomeNotice={recordOutcomeNotice}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onOpenRecords={onOpenRecords}
          onChangeDifficulty={onChangeDifficulty}
          onBackToHome={onBackToHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
      <main className="flex min-h-0 flex-1 items-center justify-center px-1 py-2 [container-type:size] sm:px-3">
        <div className="relative aspect-square w-[min(100cqw,100cqh,44rem)]">
          <ReflectionBoard
            board={board}
            clues={clues}
            clueMatches={clueMatches}
            selection={selection}
            laser={laser}
            interactionDisabled={!playing}
            progress={progress}
            onSelectCell={onSelectCell}
            onSelectClue={onSelectClue}
            onRemovePiece={onRemovePiece}
            onClearAnimationComplete={onClearAnimationComplete}
          />
        </div>
      </main>
      {/* 置き切っても揃わないときも文は出さない。どれが合っていないかは外周ヒントの一致の地で見える。 */}
      <footer className="grid shrink-0 px-3 pb-2">
        <ReflectionStock
          inventory={inventory}
          stock={stock}
          selection={selection}
          selectedCell={
            selection?.type === "cell"
              ? (board.cells[selection.cellIndex] ?? null)
              : null
          }
          disabled={!playing}
          onSelectStockPiece={onSelectStockPiece}
        />
      </footer>
    </GamePlayFrame>
  );
}

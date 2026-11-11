import { useEffect, useMemo, useRef, useState } from "react";

import { GamePlayFrame } from "@/components/GamePlayFrame";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
} from "@/games/play";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import type {
  ReflectionLaserView,
  ReflectionOperation,
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
import type {
  ReflectionDragSource,
  ReflectionDropTarget,
  ReflectionSelection,
} from "@/games/reflection/session/session";
import { ReflectionBoard } from "@/games/reflection/ui/board/ReflectionBoard";
import { ReflectionPieceIcon } from "@/games/reflection/ui/board/ReflectionPieceIcon";
import { ReflectionHowToPlayDialog } from "@/games/reflection/ui/ReflectionHowToPlayDialog";
import {
  listReflectionStockPieces,
  ReflectionStock,
} from "@/games/reflection/ui/ReflectionStock";
import { ReflectionTutorial } from "@/games/reflection/ui/ReflectionTutorial";
import { ReflectionResultScreen } from "@/games/reflection/ui/result/ReflectionResultScreen";
import { useReflectionDrag } from "@/games/reflection/ui/use-reflection-drag";
import { useReflectionSoundEffects } from "@/games/reflection/ui/use-reflection-sound-effects";
import "@/games/reflection/ui/reflection-experience.css";
import "@/games/reflection/ui/reflection-atelier.css";
import "@/games/reflection/ui/reflection-radiance.css";

type ReflectionPlayProps = GamePlayScreenProps<
  ReflectionDifficulty,
  ReflectionResult
> &
  RestartableGamePlayScreenProps & {
    board: ReflectionBoardState;
    clues: readonly ReflectionClue[];
    inventory: ReflectionInventory;
    stock: ReflectionInventory;
    selection: ReflectionSelection | null;
    laser: ReflectionLaserView | null;
    operation: ReflectionOperation | null;
    onSelectCell: (cellIndex: number) => void;
    onDragPiece: (
      source: ReflectionDragSource,
      target: ReflectionDropTarget,
    ) => void;
    onSelectStockPiece: (piece: ReflectionPiece) => void;
    onSelectClue: (entry: ReflectionEntry) => void;
    onRemovePiece: (cellIndex: number) => void;
    onClearSelection: () => void;
  };

type ReflectionExperience =
  | "original"
  | "glass"
  | "nocturne"
  | "atelier"
  | "radiance";

const experienceOptions: ReadonlyArray<{
  id: ReflectionExperience;
  label: string;
}> = [
  { id: "original", label: "現行" },
  { id: "glass", label: "硝子" },
  { id: "nocturne", label: "夜光" },
  { id: "atelier", label: "光学台" },
  { id: "radiance", label: "光彩" },
];

/** 数字キーの `1` から順に、ストックに並ぶ種類を選ぶ。 */
function getStockKeyIndex(key: string): number | null {
  return /^[1-9]$/.test(key) ? Number(key) - 1 : null;
}

export function ReflectionPlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordFeedback,
  board,
  clues,
  inventory,
  stock,
  selection,
  laser,
  operation,
  canRestart,
  onSelectCell,
  onDragPiece,
  onSelectStockPiece,
  onSelectClue,
  onRemovePiece,
  onClearSelection,
  onRestart,
  onReplay,
  onClearAnimationComplete,
  onStartNewProblem,
  onOpenGameHome,
  onBackToHome,
  onOpenDiagnostics,
}: ReflectionPlayProps) {
  const playing = progress === "playing";
  const [experience, setExperience] =
    useState<ReflectionExperience>("radiance");
  const clueMatches = useMemo(
    () => listReflectionClueMatches(board, clues),
    [board, clues],
  );
  const playAreaRef = useRef<HTMLElement>(null);
  const drag = useReflectionDrag(onDragPiece);
  useReflectionSoundEffects(operation, progress);

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
      background={
        <div
          data-reflection-background={experience}
          className="reflection-play-background size-full"
        />
      }
      // 置き直しは点に入らないので、プレイ中は時間だけを示す。置き直しの回数は結果と記録に出す。
      metrics={[{ type: "elapsed-time", elapsedMs }]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onOpenGameHome={onOpenGameHome}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <ReflectionHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose }) => (
        <ReflectionTutorial open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <ReflectionResultScreen
          difficulty={difficulty}
          result={clearedResult}
          recordFeedback={recordFeedback}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onOpenGameHome={onOpenGameHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
      <div
        className={
          experience === "radiance"
            ? "reflection-play-layout flex min-h-0 flex-1 flex-col items-center justify-center gap-4 [container-type:size]"
            : "contents"
        }
      >
        <main
          data-reflection-experience={experience}
          className={
            experience === "radiance"
              ? "reflection-play-stage flex w-full shrink-0 items-center justify-center px-1 py-0"
              : "reflection-play-stage flex min-h-0 flex-1 items-center justify-center px-1 py-2 [container-type:size] sm:px-3"
          }
        >
          <div
            className={
              experience === "radiance"
                ? "relative aspect-square w-[min(calc(100cqw-0.5rem),calc(100cqh-9rem),44rem)]"
                : "relative aspect-square w-[min(100cqw,100cqh,44rem)]"
            }
          >
            <ReflectionBoard
              board={board}
              clues={clues}
              clueMatches={clueMatches}
              selection={selection}
              laser={laser}
              interactionDisabled={!playing}
              dragHandlers={drag.getHandlers}
              dragPreview={drag.preview}
              progress={progress}
              compactClues={experience === "radiance"}
              onSelectCell={onSelectCell}
              onSelectClue={onSelectClue}
              onRemovePiece={onRemovePiece}
              onClearAnimationComplete={onClearAnimationComplete}
            />
          </div>
        </main>
        {/* 置き切っても揃わないときも文は出さない。どれが合っていないかは外周ヒントの一致の地で見える。 */}
        <footer
          data-reflection-experience={experience}
          className="reflection-play-footer grid shrink-0 px-3 pb-2"
        >
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
            dragHandlers={drag.getHandlers}
            dragPreview={drag.preview}
            onSelectStockPiece={onSelectStockPiece}
          />
          <div
            role="group"
            aria-label="光の表現を比較"
            className="reflection-experience-picker mx-auto mt-1 flex items-center gap-0.5 rounded-full p-1"
          >
            {experienceOptions.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={experience === id}
                onClick={() => setExperience(id)}
                className="reflection-experience-option min-w-14 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {label}
              </button>
            ))}
          </div>
        </footer>
      </div>
      {drag.preview ? (
        <div
          aria-hidden="true"
          className="reflection-drag-ghost pointer-events-none fixed z-50 flex items-center justify-center"
          style={{ left: drag.preview.x, top: drag.preview.y }}
        >
          <ReflectionPieceIcon piece={drag.preview.piece} size="stock" />
        </div>
      ) : null}
    </GamePlayFrame>
  );
}

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type { ReflectionLaserPathMode } from "@/games/reflection/laser-path-mode";
import type {
  ReflectionLaserView,
  ReflectionProgress,
  ReflectionResult,
} from "@/games/reflection/play/use-reflection-play";
import {
  getReflectionInventoryPieceCount,
  type ReflectionBoard as ReflectionBoardState,
  type ReflectionInventory,
  type ReflectionPiece,
} from "@/games/reflection/puzzle/board";
import type {
  ReflectionClue,
  ReflectionEntry,
} from "@/games/reflection/puzzle/laser";
import { listReflectionClueMatches } from "@/games/reflection/puzzle/rules";
import type {
  ReflectionSelection,
  ReflectionSessionResult,
} from "@/games/reflection/session/session";
import { ReflectionBoard } from "@/games/reflection/ui/board/ReflectionBoard";
import { readReflectionHowToPlaySeen } from "@/games/reflection/ui/how-to-play-seen";
import { ReflectionHowToPlayDialog } from "@/games/reflection/ui/ReflectionHowToPlayDialog";
import { ReflectionClueMatchStatus } from "@/games/reflection/ui/ReflectionPlay/ReflectionClueMatchStatus";
import { ReflectionPlayHeader } from "@/games/reflection/ui/ReflectionPlay/ReflectionPlayHeader";
import {
  listReflectionStockPieces,
  ReflectionStock,
} from "@/games/reflection/ui/ReflectionPlay/ReflectionStock";
import { ReflectionResultScreen } from "@/games/reflection/ui/result/ReflectionResultScreen";

type ReflectionPlayProps = {
  /** 結果に出す難易度の表示名。問題を指定したプレイでは難易度を伏せた名前を渡す。 */
  difficultyLabel: string;
  laserPathMode: ReflectionLaserPathMode;
  progress: ReflectionProgress;
  board: ReflectionBoardState;
  clues: readonly ReflectionClue[];
  inventory: ReflectionInventory;
  stock: ReflectionInventory;
  selection: ReflectionSelection | null;
  laser: ReflectionLaserView | null;
  elapsedMs: number;
  canRestart: boolean;
  /** クリアしたプレイの事実。クリアするまでは `null`。 */
  sessionResult: ReflectionSessionResult | null;
  /** クリアしたプレイの評価。問題集に無い問題を指定したプレイでは `null`。 */
  result: ReflectionResult | null;
  recordOutcomeNotice: ReactNode;
  onTapCell: (cellIndex: number) => void;
  onTapStock: (piece: ReflectionPiece) => void;
  onTapClue: (entry: ReflectionEntry) => void;
  onRemovePiece: (cellIndex: number) => void;
  onClearSelection: () => void;
  onRestart: () => void;
  onReplay: () => void;
  onClearAnimationComplete: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  /** 内部診断が有効なときだけ渡し、メニューに検証情報を出す。 */
  onOpenDiagnostics?: () => void;
};

/** 数字キーの `1` から順に、ストックに並ぶ種類を選ぶ。 */
function getStockKeyIndex(key: string): number | null {
  return /^[1-9]$/.test(key) ? Number(key) - 1 : null;
}

export function ReflectionPlay({
  difficultyLabel,
  laserPathMode,
  progress,
  board,
  clues,
  inventory,
  stock,
  selection,
  laser,
  elapsedMs,
  canRestart,
  sessionResult,
  result,
  recordOutcomeNotice,
  onTapCell,
  onTapStock,
  onTapClue,
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
  // 初めて遊ぶときだけ、盤面より先に遊び方を開く（intro）。
  const [howToPlay, setHowToPlay] = useState<"closed" | "intro" | "open">(() =>
    readReflectionHowToPlaySeen() ? "closed" : "intro",
  );
  const playing = progress === "playing";
  const clueMatches = useMemo(
    () => listReflectionClueMatches(board, clues),
    [board, clues],
  );
  // 手持ちを置き切っても揃っていないときだけ、合っていない外周ヒントの本数を知らせる。
  // 盤面のピースを選んでいる間は、同じ位置にストックの「ここへ戻す」を出すので知らせない。
  const unmatchedClueCount =
    playing &&
    selection?.type !== "cell" &&
    getReflectionInventoryPieceCount(stock) === 0
      ? clueMatches.filter((matched) => !matched).length
      : 0;
  const playAreaRef = useRef<HTMLElement>(null);

  function closeHowToPlay() {
    // 初めての遊び方を読んでいた時間はプレイ時間に含めないよう、閉じたところから測り直す。
    if (howToPlay === "intro") {
      onReplay();
    }
    setHowToPlay("closed");
  }

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
        onTapStock(piece);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playing, inventory, onClearSelection, onTapStock]);

  // 完成演出の間は揃った盤面と全光路をそのまま見せ、演出を終えてから結果画面に切り替える。
  if (progress === "result" && sessionResult) {
    return (
      <ReflectionResultScreen
        difficultyLabel={difficultyLabel}
        laserPathMode={laserPathMode}
        performance={sessionResult}
        result={result}
        recordOutcomeNotice={recordOutcomeNotice}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onOpenRecords={onOpenRecords}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
      />
    );
  }

  return (
    <section
      ref={playAreaRef}
      className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <BrandIdentityHeader />
      <ReflectionPlayHeader
        elapsedMs={elapsedMs}
        canRestart={canRestart}
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
        onOpenHowToPlay={() => setHowToPlay("open")}
      />
      <ReflectionHowToPlayDialog
        open={howToPlay !== "closed"}
        laserPathMode={laserPathMode}
        onClose={closeHowToPlay}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center px-1 py-2 [container-type:size] sm:px-3">
        <div className="relative aspect-square w-[min(100cqw,100cqh,44rem)]">
          <ReflectionBoard
            board={board}
            clues={clues}
            clueMatches={clueMatches}
            selection={selection}
            laser={laser}
            progress={progress}
            onTapCell={onTapCell}
            onTapClue={onTapClue}
            onRemovePiece={onRemovePiece}
            onClearAnimationComplete={onClearAnimationComplete}
          />
        </div>
      </main>
      <footer className="grid shrink-0 gap-2 px-3 pb-2">
        <ReflectionClueMatchStatus unmatchedClueCount={unmatchedClueCount} />
        <ReflectionStock
          inventory={inventory}
          stock={stock}
          selection={selection}
          disabled={!playing}
          onTapStock={onTapStock}
        />
      </footer>
    </section>
  );
}

import { type ReactNode, useRef } from "react";
import type { ShuttleParkingOperation } from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import type { ShuttleParkingProblem } from "@/games/shuttle-parking/problem/problem";
import type { ShuttleParkingCarId } from "@/games/shuttle-parking/puzzle/lot";
import type { ShuttleParkingState } from "@/games/shuttle-parking/puzzle/rules";
import { ShuttleParkingBays } from "@/games/shuttle-parking/ui/board/ShuttleParkingBays";
import { ShuttleParkingLot } from "@/games/shuttle-parking/ui/board/ShuttleParkingLot";
import { ShuttleParkingQueue } from "@/games/shuttle-parking/ui/board/ShuttleParkingQueue";
import { useShuttleParkingClearAnimation } from "@/games/shuttle-parking/ui/board/use-clear-animation";
import { useShuttleParkingExitPlayback } from "@/games/shuttle-parking/ui/board/use-exit-playback";
import { cn } from "@/lib/utils";

type ShuttleParkingSceneProps = {
  problem: ShuttleParkingProblem;
  state: ShuttleParkingState;
  operation: ShuttleParkingOperation | null;
  interactionDisabled: boolean;
  onExitCar: (carId: ShuttleParkingCarId) => void;
  /** 待機枠と同じ行の左に置く操作。 */
  leadingAction?: ReactNode;
  /**
   * 出庫の動きを見せ終えてから、駐車場のすぐ下に出す知らせ（詰みの知らせ）。駐車場を隠さないよう下の空きに置き、
   * 空きに収まらない画面（横長・狭い縦長）では駐車場の下端に重ねる。
   */
  renderLotNotice?: () => ReactNode;
  /** 車の上に重ねる物（チュートリアルの印・遊び方の押す所の手がかり）。本番では渡さない。 */
  renderCarOverlay?: (carId: ShuttleParkingCarId) => ReactNode;
  clearing?: boolean;
  onClearAnimationComplete?: () => void;
  /** `fill` は残りの高さいっぱいに駐車場を広げる。`figure` は置き場所の幅で描く。 */
  layout?: "fill" | "figure";
};

function ignoreClearAnimationComplete() {}

/**
 * 上から乗客の列・待機枠の行・駐車場を積んだ、盤面の全体。
 * 出庫の動きは、駐車場は今の状態ですぐ次の車を押せるようにし、列と待機枠は時刻どおりに1つずつ進める。
 */
export function ShuttleParkingScene({
  problem,
  state,
  operation,
  interactionDisabled,
  onExitCar,
  leadingAction,
  renderLotNotice,
  renderCarOverlay,
  clearing = false,
  onClearAnimationComplete = ignoreClearAnimationComplete,
  layout = "fill",
}: ShuttleParkingSceneProps) {
  const lotRef = useRef<HTMLDivElement>(null);
  const { frame } = useShuttleParkingExitPlayback(
    operation?.type === "exited"
      ? {
          id: operation.id,
          timeline: operation.timeline,
          startedAt: operation.startedAt,
        }
      : null,
  );
  useShuttleParkingClearAnimation(
    lotRef,
    clearing,
    frame === null,
    onClearAnimationComplete,
  );

  const lot = (
    <div
      ref={lotRef}
      className="relative"
      style={layout === "fill" ? { width: "min(100cqw, 100cqh)" } : undefined}
    >
      <ShuttleParkingLot
        lot={problem.lot}
        parkedCarIds={state.parkedCarIds}
        operation={operation}
        interactionDisabled={interactionDisabled}
        renderCarOverlay={renderCarOverlay}
        onExitCar={onExitCar}
      />
    </div>
  );
  const notice = frame === null && renderLotNotice ? renderLotNotice() : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        layout === "fill" && "min-h-0 flex-1",
      )}
    >
      <ShuttleParkingQueue
        passengers={problem.passengers}
        boardedCount={frame?.boardedCount ?? state.boardedCount}
      />
      <ShuttleParkingBays
        cars={problem.lot.cars}
        bayCount={problem.bayCount}
        waitingCars={frame?.waitingCars ?? state.waitingCars}
        departingCarId={frame?.departingCarId ?? null}
        fullNoticeKey={
          operation?.type === "blocked" && operation.reason === "bays-full"
            ? operation.id
            : null
        }
        leadingAction={leadingAction}
      />
      {layout === "fill" ? (
        <div
          className="relative flex min-h-0 flex-1 items-start justify-center"
          style={{ containerType: "size" }}
        >
          {lot}
          {notice ? (
            // 駐車場の下端から画面の下の余白までを置き場にする。収まれば駐車場のすぐ下（mb-auto）に、
            // 収まらなければ置き場の下端にそろえて上へはみ出し、駐車場の下端に重なる（justify-end）。
            <div
              className="pointer-events-none absolute inset-x-0 -bottom-4 flex flex-col items-center justify-end"
              style={{ top: "calc(min(100cqw, 100cqh) + 0.5rem)" }}
            >
              <div className="pointer-events-auto mb-auto max-w-full">
                {notice}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {lot}
          {notice}
        </>
      )}
    </div>
  );
}

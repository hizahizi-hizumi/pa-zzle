import { useEffect, useRef, useState } from "react";
import { HowToPlayCaptionLayers } from "@/components/HowToPlayCaptionLayers";
import { HowToPlayExample } from "@/components/HowToPlayExample";
import { useReportHowToPlayExampleChange } from "@/components/HowToPlayExamplePanel";
import { HowToPlayPressHint } from "@/components/HowToPlayPressHint";
import {
  HowToPlayVerdict,
  type HowToPlayVerdictLabels,
} from "@/components/HowToPlayVerdict";
import type { ShuttleParkingOperation } from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import type { ShuttleParkingCarId } from "@/games/shuttle-parking/puzzle/lot";
import { ShuttleParkingScene } from "@/games/shuttle-parking/ui/board/ShuttleParkingScene";
import {
  createShuttleParkingExampleBoard,
  isShuttleParkingExampleChanged,
  judgeShuttleParkingExample,
  type ShuttleParkingExampleVerdict,
  type ShuttleParkingHowToPlayExample,
  tapShuttleParkingExampleCar,
} from "@/games/shuttle-parking/ui/ShuttleParkingHowToPlayDialog/example-board";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * 例の下に添える言葉の種類。
 * - `exit`: 出られるか（出口・前の車・待機枠のルール）。
 * - `board`: 押した後に何人が乗り、何台が出発したか。
 * - `none`: 言葉を添えない（操作の例）。
 */
export type ShuttleParkingExampleCaption = "exit" | "board" | "none";

const untriedLabels: HowToPlayVerdictLabels = {
  allowed: "出られる",
  disallowed: "出られない",
};
const triedLabels: HowToPlayVerdictLabels = {
  allowed: "出られた",
  disallowed: "出られない",
};

const blockReasons = {
  "path-blocked": "前に車がある",
  "bays-full": "待機枠が埋まっている",
} as const;

function renderCaption(
  caption: ShuttleParkingExampleCaption,
  verdict: ShuttleParkingExampleVerdict,
) {
  if (caption === "none") return undefined;
  if (caption === "board") {
    // 押す前は言葉を出さず、押した後にその手で起きたことを言う（違いが出る例。判定はしない）。
    return (
      <HowToPlayCaptionLayers
        layers={[
          { id: "untried", shown: !verdict.tried, content: null },
          {
            id: "tried",
            shown: verdict.tried,
            content: `${verdict.boardedCount}人が乗り ${verdict.departedCount}台が出発`,
          },
        ]}
      />
    );
  }
  return (
    <HowToPlayVerdict
      verdict={verdict.exitable ? "allowed" : "disallowed"}
      labels={verdict.tried ? triedLabels : untriedLabels}
      ruleReason={
        verdict.reason === null ? undefined : blockReasons[verdict.reason]
      }
    />
  );
}

/**
 * 乗る例の言葉は、乗車と出発の動きを見せ終えてから出す。動きの途中で結果の人数を言うと、盤面と食い違うため。
 * 出せなかった手と、動かさない設定では、すぐ出す。
 */
function useSettledOperation(
  operation: ShuttleParkingOperation | null,
): boolean {
  const [settledId, setSettledId] = useState<number | null>(null);
  const exited = operation?.type === "exited" ? operation : null;
  useEffect(() => {
    if (exited === null) return;
    const remaining =
      exited.startedAt + exited.timeline.durationMs - Date.now();
    const timer = window.setTimeout(
      () => setSettledId(exited.id),
      prefersReducedMotion() ? 0 : Math.max(0, remaining),
    );
    return () => window.clearTimeout(timer);
  }, [exited]);
  return exited === null || settledId === exited.id;
}

type TouchableExampleProps = {
  example: ShuttleParkingHowToPlayExample;
  caption: ShuttleParkingExampleCaption;
};

/**
 * 触れる例。本番と同じ盤面の全体（列・待機枠・駐車場）で、車を押すと本番と同じく出て乗せ、出せないときは揺らす。
 * 押す所の手がかりは、押す前の手がかりの車にだけ付け、押した後は消す。
 */
export function TouchableExample({ example, caption }: TouchableExampleProps) {
  const [board, setBoard] = useState(() =>
    createShuttleParkingExampleBoard(example),
  );
  const operationIdRef = useRef(1);
  const reportChange = useReportHowToPlayExampleChange();
  const verdict = judgeShuttleParkingExample(board, example.hintCarId);
  const settled = useSettledOperation(board.operation);

  function handleExitCar(carId: ShuttleParkingCarId): void {
    const next = tapShuttleParkingExampleCar(
      board,
      carId,
      operationIdRef.current++,
      Date.now(),
    );
    if (next === board) return;
    setBoard(next);
    reportChange(
      isShuttleParkingExampleChanged(next) || next.operation !== null,
    );
  }

  return (
    <HowToPlayExample
      figure={
        <div style={{ width: `${(board.puzzle.lot.size + 1) * 2.25}rem` }}>
          <ShuttleParkingScene
            problem={board.puzzle}
            state={board.state}
            operation={board.operation}
            interactionDisabled={false}
            onExitCar={handleExitCar}
            layout="figure"
            renderCarOverlay={(carId) =>
              board.operation === null && carId === example.hintCarId ? (
                <span className="pointer-events-none absolute inset-0 [container-type:size]">
                  <HowToPlayPressHint
                    frame="outside"
                    outline="rounded"
                    pointer="fingertip-on-center"
                    ground="light"
                  />
                </span>
              ) : null
            }
          />
        </div>
      }
      caption={renderCaption(
        caption,
        settled ? verdict : { ...verdict, tried: false },
      )}
    />
  );
}

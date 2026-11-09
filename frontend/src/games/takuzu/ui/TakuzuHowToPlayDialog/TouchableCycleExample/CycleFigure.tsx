import { ArrowLeft, ArrowRight, ChevronUp } from "lucide-react";
import { Fragment } from "react";

import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import { takuzuTileNames } from "@/games/takuzu/ui/board/tile-names";
import { createTakuzuExampleBoard } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/example-board";
import type {
  TakuzuHowToPlayFigureBoard,
  TakuzuHowToPlayOperationFigures,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/figure-boards";
import { HowToPlayFigure } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/HowToPlayFigure";
import { cn } from "@/lib/utils";

type CycleFigureProps = {
  /** 巡る順のマスと、巡る向き。 */
  cycle: TakuzuHowToPlayOperationFigures;
  /** 最後のマスから最初のマスへ戻る線を引くか。 */
  returns?: boolean;
  /** 今の姿にあたるマスの番号。そのマスの外枠をほかのマスより濃くして示す。 */
  currentFrame?: number;
};

const arrowClassName = "mx-2 size-5 shrink-0 text-muted-foreground";

const arrowIcons = {
  forward: ArrowRight,
  backward: ArrowLeft,
} as const satisfies Record<TakuzuCycleDirection, typeof ArrowRight>;

function getFrameName(board: TakuzuHowToPlayFigureBoard): string {
  const cell = createTakuzuExampleBoard(board).board.cells[0] ?? null;
  return cell === null ? "空き" : takuzuTileNames[cell];
}

const directionNames = {
  forward: "",
  backward: "右クリックでは",
} as const satisfies Record<TakuzuCycleDirection, string>;

/** 読み上げでは、巡る順の図を1枚の絵として、向き・巡る順・今の姿を伝える。 */
function describeCycle(
  { direction, steps }: TakuzuHowToPlayOperationFigures,
  returns: boolean,
  currentFrame: number | undefined,
): string {
  const names = steps.map(getFrameName);
  const ordered = direction === "forward" ? names : [...names].reverse();
  const current = currentFrame === undefined ? undefined : names[currentFrame];
  return [
    `${directionNames[direction]}${ordered.join("、")}の順に変わる`,
    returns ? `${ordered.at(-1)}の次は${ordered[0]}に戻る` : null,
    current === undefined ? null : `今は${current}`,
  ]
    .filter((sentence) => sentence !== null)
    .join("。");
}

/** 戻る線の矢じりを付ける端。戻った先のマスの側に付ける。 */
const returnArrowheadEnds = {
  forward: "first",
  backward: "last",
} as const satisfies Record<TakuzuCycleDirection, "first" | "last">;

const returnLineClassName =
  "relative mt-2 h-4 self-start border-muted-foreground border-b-2";

/**
 * 戻る線の、格子の1列ぶんの区切り。最初と最後のマスの列ではマスの中央から立ち上げ、間の列では下の線だけを引く。
 * 区切りを列ごとに置くので、線の両端はマスの大きさを知らずにマスの中央にそろう。
 */
function renderReturnLineSegment(
  position: "first" | "middle" | "last",
  arrowheadEnd: "first" | "last",
) {
  return (
    <span
      className={cn(
        returnLineClassName,
        position === "first" &&
          "w-1/2 justify-self-end rounded-bl-md border-l-2",
        position === "middle" && "w-full",
        position === "last" &&
          "w-1/2 justify-self-start rounded-br-md border-r-2",
      )}
    >
      {position === arrowheadEnd ? (
        <ChevronUp
          className={cn(
            "absolute -top-3 size-5 text-muted-foreground",
            position === "first" ? "-left-[11px]" : "-right-[11px]",
          )}
          strokeWidth={2.5}
        />
      ) : null}
    </span>
  );
}

/**
 * マスが巡る順の図。空き、四角、丸を向きの矢印でつなぎ、最後のマスから最初のマスへ戻る線を下に引く。
 * 右クリックの図は、同じ並びのマスを逆向きの矢印でつなぎ、戻る線の矢じりを逆の端に付ける。
 * マスは、ルールの例と同じ大きさの、本番の盤面のマスで描く。
 * マスと矢印を格子の列に並べ、戻る線はその下の段に列ごとに引く。
 */
export function CycleFigure({
  cycle,
  returns = true,
  currentFrame,
}: CycleFigureProps) {
  const { direction, steps } = cycle;
  const Arrow = arrowIcons[direction];
  const arrowheadEnd = returnArrowheadEnds[direction];
  const lastIndex = steps.length - 1;
  return (
    <span
      role="img"
      aria-label={describeCycle(cycle, returns, currentFrame)}
      className={cn(
        "inline-grid grid-flow-col items-center",
        returns ? "grid-rows-[auto_auto]" : "grid-rows-1",
      )}
    >
      {steps.map((board, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 巡る順のマスは、並び順そのものが識別になる
        <Fragment key={index}>
          {index > 0 ? (
            <>
              <Arrow className={arrowClassName} strokeWidth={2.5} />
              {returns ? renderReturnLineSegment("middle", arrowheadEnd) : null}
            </>
          ) : null}
          <span className="flex">
            <HowToPlayFigure
              example={createTakuzuExampleBoard(board)}
              size="example"
              outlined={index === currentFrame}
            />
          </span>
          {returns
            ? renderReturnLineSegment(
                index === 0 ? "first" : index === lastIndex ? "last" : "middle",
                arrowheadEnd,
              )
            : null}
        </Fragment>
      ))}
    </span>
  );
}

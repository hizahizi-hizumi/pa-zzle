import { HowToPlayCaptionLayers } from "@/components/HowToPlayCaptionLayers";
import {
  HowToPlayVerdict,
  type HowToPlayVerdictLabels,
} from "@/components/HowToPlayVerdict";
import { HowToPlayVerdictLine } from "@/components/HowToPlayVerdictLine";
import { getSlidePuzzleBoardSize } from "@/games/slide-puzzle/puzzle/state";
import {
  countSlidePuzzleExampleSlidingTiles,
  isSameSlidePuzzleBoard,
  type SlidePuzzleExampleState,
  type SlidePuzzleHintedExample,
} from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/example-board";

type CarryCaptionProps = {
  example: SlidePuzzleHintedExample;
  state: SlidePuzzleExampleState;
};

/**
 * - `predicted`: 最初の盤面で、手がかりのタイルを押すとスライドする枚数。
 * - `slid`: 試した手でスライドした枚数。
 * - `rejected`: 空白と同じ行・列にないタイルを押して、動かなかった。
 */
type CarryCaptionShown =
  | { kind: "predicted" | "slid"; tileCount: number }
  | { kind: "rejected" };

/** 動かなかった手の判定の言葉。押す前と押した後の言葉は枚数で言うので、✓ の言葉は出さない。 */
const rejectionLabels: HowToPlayVerdictLabels = {
  allowed: "スライドする",
  disallowed: "スライドしない",
};

/** 空白と同じ行・列にないタイルを押して動かなかったわけ。動く枚数と完成の例が、教えるルールとは別に破ったルールとして添える。 */
export const slideRejectionReason = "空白と同じ行・列にない";

function getShown(
  example: SlidePuzzleHintedExample,
  { board, lastMove }: SlidePuzzleExampleState,
): CarryCaptionShown {
  if (lastMove?.type === "rejected") {
    return { kind: "rejected" };
  }
  const [hintTile] = example.hintTiles;
  if (lastMove === null || isSameSlidePuzzleBoard(board, example.board)) {
    return {
      kind: "predicted",
      tileCount: countSlidePuzzleExampleSlidingTiles(board, hintTile),
    };
  }
  return { kind: "slid", tileCount: lastMove.slide.movedTileIndices.length };
}

function describe(shown: CarryCaptionShown): string {
  switch (shown.kind) {
    case "predicted":
      return `${shown.tileCount}枚がスライドする`;
    case "slid":
      return `${shown.tileCount}枚がスライドした`;
    case "rejected":
      return "スライドしない";
  }
}

/** 盤面で出しうるすべての言葉。 */
function listAllShown(example: SlidePuzzleHintedExample): CarryCaptionShown[] {
  const maxTileCount = getSlidePuzzleBoardSize(example.board) - 1;
  const tileCounts = Array.from(
    { length: maxTileCount },
    (_, index) => index + 1,
  );
  return [
    ...tileCounts.map((tileCount) => ({
      kind: "predicted" as const,
      tileCount,
    })),
    ...tileCounts.map((tileCount) => ({ kind: "slid" as const, tileCount })),
    { kind: "rejected" },
  ];
}

/**
 * 動く枚数のルールの例の下に添える、起きること。押す前は手がかりのタイルを押すと何枚スライドするかを、押した後はスライドした枚数を言う。
 * 空白と同じ行・列にないタイルを押して動かなかったときは、✕ と、例が教えるルールとは別に破ったルールを添える。
 */
export function CarryCaption({ example, state }: CarryCaptionProps) {
  const shownWords = describe(getShown(example, state));
  return (
    <HowToPlayCaptionLayers
      layers={listAllShown(example).map((candidate) => {
        const words = describe(candidate);
        const shown = words === shownWords;
        return {
          id: words,
          shown,
          content:
            candidate.kind === "rejected" ? (
              <HowToPlayVerdict
                verdict="disallowed"
                labels={rejectionLabels}
                reason={shown ? slideRejectionReason : undefined}
              />
            ) : (
              <HowToPlayVerdictLine>{words}</HowToPlayVerdictLine>
            ),
        };
      })}
    />
  );
}

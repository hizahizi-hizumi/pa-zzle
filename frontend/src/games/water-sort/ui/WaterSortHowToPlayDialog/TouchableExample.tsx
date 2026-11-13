import { HowToPlayExample } from "@/components/HowToPlayExample";
import {
  HowToPlayVerdict,
  type HowToPlayVerdictLabels,
} from "@/components/HowToPlayVerdict";
import type { WaterSortRejection } from "@/games/water-sort/puzzle/bottle-selection";
import {
  countWaterSortTopColorUnits,
  getWaterSortPourAmount,
} from "@/games/water-sort/puzzle/rules";
import { BottleSizeScope } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/BottleSizeScope";
import {
  exampleMove,
  type WaterSortHowToPlayExample,
} from "@/games/water-sort/ui/WaterSortHowToPlayDialog/figure-boards";
import { HowToPlayBoard } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/HowToPlayBoard";
import {
  type DestinationAnswer,
  DestinationVerdicts,
} from "@/games/water-sort/ui/WaterSortHowToPlayDialog/TouchableExample/DestinationVerdicts";
import {
  getWaterSortExampleHintBottleIndex,
  judgeWaterSortExampleDestinations,
  judgeWaterSortExampleSelection,
  listWaterSortExampleDestinationRejections,
  type WaterSortExampleBoard,
} from "@/games/water-sort/ui/WaterSortHowToPlayDialog/TouchableExample/example-board";
import { useTouchableExample } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/TouchableExample/use-touchable-example";
import { cn } from "@/lib/utils";

/**
 * 図の下に添える言葉。
 * - `destinations`: 各ボトルの真下に、今選んでいるボトルからそのボトルへ注げるかの答え（✓ / ✕）と、その下に印の言葉。
 *   答えは今の盤面から求める。✕ のボトルには、押す前から ✕ の真下に注げないわけを1つ添える。
 *   注いだ後は、試した手の結果として、注いだボトルの真下に ✓ と「注げた」を添える。
 * - `selection`: 試した手で、注ぐボトルに選べたかの判定。試す前は、例の左のボトルを選べるかを判定する。
 *   `rule` は例が教えるルールで、ほかのわけで弾かれたときは、そのわけを添える。
 * - `amount`: 左から2本目へ注いで入る量と、上に続く同じ色が全部入るか空きの分だけ入るか。注いだ後は、注いだ量にする。
 */
export type TouchableExampleCaption =
  | { kind: "destinations" }
  | { kind: "selection"; rule: WaterSortRejection }
  | { kind: "amount" };

/**
 * 2つの例を横に並べる対で、この例を置く側。
 * 2つの例を別の盤面と見分けられるよう、相手の例に向く側にだけ余白を足し、例を並べる面が取る間（12px）と合わせて、
 * 例の間をボトルの間の3倍以上（スマートフォンで 32px、PC で 40px）にする。外側に足さないのは、幅 375px の画面でも横に並べるため。
 * 言葉も同じ余白を持ち、例の盤面の真下の中央に来る。
 */
type TouchableExamplePairSide = "left" | "right";

const pairSidePaddings = {
  left: "pr-2.5 lg:pr-3.5",
  right: "pl-2.5 lg:pl-3.5",
} as const satisfies Record<TouchableExamplePairSide, string>;

type TouchableExampleProps = {
  example: WaterSortHowToPlayExample;
  /** 渡さない例（操作の例）は、言葉を添えず、元に戻すボタンを図の右に出す。 */
  caption?: TouchableExampleCaption;
  /** 対で並べる例だけに渡す。 */
  pairSide?: TouchableExamplePairSide;
};

/**
 * 注ぐ量の言葉。量は注ぎ先の空きで決まるので、上に続く同じ色が全部入るか、空きの分だけ入るかを言う。
 * 注いだ後は、注いだ量にする。
 */
function describeAmount(board: WaterSortExampleBoard): string {
  const { bottles, lastPour } = board;
  const topColorUnits =
    lastPour?.topColorUnits ??
    countWaterSortTopColorUnits(bottles[exampleMove.sourceBottleIndex] ?? []);
  const amount =
    lastPour?.amount ?? getWaterSortPourAmount(bottles, exampleMove);
  if (amount < topColorUnits) {
    return `${amount}つだけ入る`;
  }
  return amount === 1 ? "1つ入る" : `${amount}つとも入る`;
}

/** 注ぐボトルに選べるかの判定の言葉。 */
const selectionLabels: HowToPlayVerdictLabels = {
  allowed: "選べる",
  disallowed: "選べない",
};

/**
 * 注いだ後の判定の言葉。注いだ後の盤面では同じボトルを選べるとは限らないので、試した手の結果として「選べた」と言う。
 * 「選べる」と同じ字数にし、言葉が替わっても周りを動かさない。
 */
const pouredSelectionLabels: HowToPlayVerdictLabels = {
  allowed: "選べた",
  disallowed: "選べない",
};

/** 最後に試した手が、注いだ手か。選んでいる間と、選ばずに押して弾かれた後は、試した手は注いだ手ではない。 */
function hasPouredSinceTry(board: WaterSortExampleBoard): boolean {
  return (
    board.sourceBottleIndex === null &&
    board.rejection === null &&
    board.lastPour !== null
  );
}

/** 弾かれたわけの言葉。判定の言葉の下に添える。 */
const rejectionNames = {
  empty: "空っぽ",
  complete: "1色でいっぱい",
  "no-destination": "どこにも注げない",
  full: "満杯",
  "different-color": "色違い",
} as const satisfies Record<WaterSortRejection, string>;

/**
 * 注げないわけの言葉。ボトルの下に収まるよう1つだけにし、満杯なら色を比べるまでもないので「満杯」を先にする。
 */
function describePourRejection(
  rejections: readonly WaterSortRejection[],
): string | null {
  const rejection = rejections.includes("full") ? "full" : rejections[0];
  return rejection === undefined ? null : rejectionNames[rejection];
}

/**
 * 各ボトルの真下に付ける答え。選んでいる間は、今の盤面で選んでいるボトルから注げるか。
 * 注いだ後は、注いだ後の盤面で同じ手が通るとは限らないので、試した手の結果として注いだボトルにだけ付ける。
 */
function listDestinationAnswers(
  board: WaterSortExampleBoard,
): (DestinationAnswer | null)[] {
  const { bottles, lastPour } = board;
  if (lastPour !== null && hasPouredSinceTry(board)) {
    return bottles.map((_, bottleIndex) =>
      bottleIndex === lastPour.move.destinationBottleIndex
        ? { result: "poured" }
        : null,
    );
  }
  const verdicts = judgeWaterSortExampleDestinations(board);
  const rejections = listWaterSortExampleDestinationRejections(board);
  return bottles.map((_, bottleIndex) => {
    const allowed = verdicts?.[bottleIndex] ?? null;
    if (allowed === null) {
      return null;
    }
    return allowed
      ? { result: "allowed" }
      : {
          result: "disallowed",
          reason: describePourRejection(rejections?.[bottleIndex] ?? []),
        };
  });
}

/** 弾かれたわけのうち、例が教えるルールと別のもの。教えるルールで弾かれたときは添えない。 */
function findOtherRejection(
  rejections: readonly WaterSortRejection[],
  rule: WaterSortRejection,
): WaterSortRejection | undefined {
  return rejections.includes(rule) ? undefined : rejections[0];
}

/**
 * 触れる例。押すと本番と同じに選び・注ぎ・揺れ、図の下の言葉は、本番の判定で今の姿から求め直す。
 * 押す所の手がかりは、最初の形のときだけ、注ぐボトル、注ぎ先の順に付け、どのボトルで弾かれても、選び直すか元に戻すまで消す。
 * 例の面の高さは中身で決まる。盤面の上には選んだボトルの持ち上げだけを取り、下は言葉の段までにする。
 */
export function TouchableExample({
  example,
  caption,
  pairSide,
}: TouchableExampleProps) {
  const { board, operation, boardRef, tap } = useTouchableExample(example);
  const pairPadding =
    pairSide === undefined ? undefined : pairSidePaddings[pairSide];

  function renderCaptionContent() {
    if (caption === undefined) {
      return undefined;
    }
    switch (caption.kind) {
      case "destinations":
        return <DestinationVerdicts answers={listDestinationAnswers(board)} />;
      case "selection": {
        const { allowed, rejections } = judgeWaterSortExampleSelection(board);
        const reason = findOtherRejection(rejections, caption.rule);
        return (
          <HowToPlayVerdict
            verdict={allowed ? "allowed" : "disallowed"}
            labels={
              hasPouredSinceTry(board) ? pouredSelectionLabels : selectionLabels
            }
            reason={reason === undefined ? undefined : rejectionNames[reason]}
          />
        );
      }
      case "amount":
        return describeAmount(board);
    }
  }

  return (
    <BottleSizeScope size="example">
      <HowToPlayExample
        figure={
          <div className={pairPadding}>
            <HowToPlayBoard
              ref={boardRef}
              bottles={board.bottles}
              size="example"
              sourceBottleIndex={board.sourceBottleIndex}
              operation={operation}
              onSelectBottle={tap}
              hintedBottleIndex={getWaterSortExampleHintBottleIndex(
                board,
                example,
              )}
            />
          </div>
        }
        caption={
          caption === undefined ? undefined : (
            <span className={cn("flex w-full justify-center", pairPadding)}>
              {renderCaptionContent()}
            </span>
          )
        }
      />
    </BottleSizeScope>
  );
}

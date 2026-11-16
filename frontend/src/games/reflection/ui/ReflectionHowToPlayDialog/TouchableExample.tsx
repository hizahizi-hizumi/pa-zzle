import { HowToPlayCaptionLayers } from "@/components/HowToPlayCaptionLayers";
import { HowToPlayExample } from "@/components/HowToPlayExample";
import {
  HowToPlayVerdict,
  type HowToPlayVerdictLabels,
} from "@/components/HowToPlayVerdict";
import { HowToPlayVerdictLine } from "@/components/HowToPlayVerdictLine";
import type { ReflectionBoard as ReflectionBoardState } from "@/games/reflection/puzzle/board";
import {
  type ReflectionEntry,
  type ReflectionOutcome,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import { getReflectionSessionStock } from "@/games/reflection/session/session";
import type { ReflectionCue } from "@/games/reflection/ui/board/cue";
import { ReflectionBoard } from "@/games/reflection/ui/board/ReflectionBoard";
import { ReflectionOutcomeMark } from "@/games/reflection/ui/board/ReflectionOutcomeMark";
import {
  findReflectionExampleUnmatchedExitClue,
  getReflectionExampleHint,
  getReflectionExampleLaser,
  isReflectionExampleClueMatched,
  judgeReflectionExampleCompletion,
  listReflectionExampleClueMatches,
  listReflectionExampleReachableBoards,
  type ReflectionExampleBoard,
} from "@/games/reflection/ui/ReflectionHowToPlayDialog/example-board";
import type { ReflectionHowToPlayExample } from "@/games/reflection/ui/ReflectionHowToPlayDialog/figure-boards";
import {
  getReflectionFigureFrame,
  reflectionFigureUnitClassName,
} from "@/games/reflection/ui/ReflectionHowToPlayDialog/figure-size";
import { useTouchableExample } from "@/games/reflection/ui/ReflectionHowToPlayDialog/TouchableExample/use-touchable-example";
import { ReflectionStock } from "@/games/reflection/ui/ReflectionStock";
import { reflectionOutcomeToneClassNames } from "@/games/reflection/ui/reflection-tone";
import { cn } from "@/lib/utils";

/**
 * 図の下に添える言葉。どれも、光路を出している数字か、出していなければ例の `focusEntry` の数字について、今の盤面から求め直す。
 * - `match`: その数字が今の光と合うか（✓ 合う / ✕ 合わない）。数と印は同じでも出た先の数字が違って合わないときは、盤面からは読み取りにくいので、判定の下にルールそのもののわけとして出た先の数字を添える。
 * - `light`: その数字から入れた光が今の盤面でどう進むか（「上から3マスで左へ出る」など）。頭に、行き先と同じ印を付ける。
 * - `completion`: 手持ちが残る間は途中、置き切って完成なら ✓ 完成、合わない数字が残れば ✕。
 */
export type TouchableExampleCaption = "match" | "light" | "completion";

type TouchableExampleProps = {
  example: ReflectionHowToPlayExample;
  /** 渡さない例（操作の例）は、言葉を添えない。 */
  caption?: TouchableExampleCaption;
};

const matchLabels: HowToPlayVerdictLabels = {
  allowed: "合う",
  disallowed: "合わない",
};

const completionLabels: HowToPlayVerdictLabels = {
  allowed: "完成",
  disallowed: "合わない数字がある",
};

const sideWords = {
  top: "上",
  right: "右",
  bottom: "下",
  left: "左",
} as const satisfies Record<ReflectionEntry["side"], string>;

/** `entry` から入れた光が `board` でどう進むかを、本番の光の進み方から言う。どの数字のことかが分かるよう、入れた辺から言う。 */
function describeLight(
  board: ReflectionBoardState,
  entry: ReflectionEntry,
): { outcome: ReflectionOutcome; text: string } {
  const { outcome, distance, exit } = traceReflectionLaser(board, entry);
  const from = `${sideWords[entry.side]}から`;
  switch (outcome) {
    case "exit":
      return {
        outcome,
        text: `${from}${distance}マスで${exit === null ? "" : sideWords[exit.side]}へ出る`,
      };
    case "reflect":
      return { outcome, text: `${from}${distance}マスで戻る` };
    case "absorb":
      return { outcome, text: `${from}${distance}マス目で吸い込まれる` };
  }
}

/**
 * 光の進み方の言葉として出しうるものすべて。描く数字のどれかから入れた光を、例のピースをどのマスへ動かした盤面でも言い、
 * 同じ言葉は1つにまとめる。言葉の層は、いちばん長い言葉の幅で場所を取る。
 */
function listLightDescriptions(
  example: ReflectionHowToPlayExample,
): { outcome: ReflectionOutcome; text: string }[] {
  const descriptions = new Map<string, ReflectionOutcome>();
  for (const board of listReflectionExampleReachableBoards(example)) {
    for (const entry of example.visibleEntries ?? []) {
      const { outcome, text } = describeLight(board, entry);
      descriptions.set(text, outcome);
    }
  }
  return [...descriptions].map(([text, outcome]) => ({ outcome, text }));
}

function listCues(
  board: ReflectionExampleBoard,
  example: ReflectionHowToPlayExample,
): ReflectionCue[] {
  const hint = getReflectionExampleHint(board, example);
  return hint === null ? [] : [{ target: hint, kind: "hint" }];
}

/**
 * 触れる例。本番の盤面とストックの部品に、例の session の盤面・選んでいる物・光路・一致を渡して描き、押した所を session の操作で進める。
 * 図の下の言葉は、描くたびに今の session から求める。
 */
export function TouchableExample({ example, caption }: TouchableExampleProps) {
  const { board, progress, tap, removePiece, finishClearAnimation } =
    useTouchableExample(example);
  const { session } = board;
  const { puzzleState, problem, selection } = session;
  const interactionDisabled = progress !== "playing";

  function renderCaptionContent() {
    const entry = session.laserEntry ?? example.focusEntry;
    switch (caption) {
      case undefined:
        return undefined;
      case "match": {
        if (entry === undefined) {
          return undefined;
        }
        const matched = isReflectionExampleClueMatched(board, entry);
        const exitClue = matched
          ? null
          : findReflectionExampleUnmatchedExitClue(board, entry);
        return (
          <HowToPlayVerdict
            verdict={matched ? "allowed" : "disallowed"}
            labels={matchLabels}
            ruleReason={
              exitClue === null
                ? undefined
                : `出た先の数字は${exitClue.distance}`
            }
          />
        );
      }
      case "light": {
        if (entry === undefined) {
          return undefined;
        }
        const { text: shownText } = describeLight(puzzleState, entry);
        return (
          <HowToPlayCaptionLayers
            layers={listLightDescriptions(example).map(({ outcome, text }) => ({
              id: text,
              shown: text === shownText,
              content: (
                <HowToPlayVerdictLine
                  mark={
                    <span
                      className={cn(
                        "flex",
                        reflectionOutcomeToneClassNames[outcome],
                      )}
                    >
                      <ReflectionOutcomeMark outcome={outcome} size="legend" />
                    </span>
                  }
                >
                  {text}
                </HowToPlayVerdictLine>
              ),
            }))}
          />
        );
      }
      case "completion": {
        const completion = judgeReflectionExampleCompletion(board);
        return (
          <HowToPlayVerdict
            verdict={
              completion === "solved"
                ? "allowed"
                : completion === "unsolved"
                  ? "disallowed"
                  : "incomplete"
            }
            labels={completionLabels}
          />
        );
      }
    }
  }

  const captionContent = renderCaptionContent();
  const frame = getReflectionFigureFrame(problem.size, example.visibleEntries);
  const cues = listCues(board, example);
  return (
    // マスの大きさは CSS 変数で渡すので、箱を作らずに中の例へ渡し、例を並べる面の並びを変えない。
    <div className={cn("contents", reflectionFigureUnitClassName)}>
      <HowToPlayExample
        figure={
          <div className="flex flex-col items-center gap-2">
            <div className="relative" style={frame.frame}>
              <div className="absolute" style={frame.board}>
                <ReflectionBoard
                  board={puzzleState}
                  clues={problem.clues}
                  clueMatches={listReflectionExampleClueMatches(board)}
                  selection={selection}
                  laser={getReflectionExampleLaser(board)}
                  interactionDisabled={interactionDisabled}
                  progress={progress}
                  onSelectCell={(cellIndex) => tap({ type: "cell", cellIndex })}
                  onSelectClue={(entry) => tap({ type: "clue", entry })}
                  onRemovePiece={removePiece}
                  onClearAnimationComplete={finishClearAnimation}
                  cues={cues}
                  visibleEntries={example.visibleEntries}
                  initialPiecesStill
                />
              </div>
            </div>
            {example.showsStock ? (
              <ReflectionStock
                inventory={problem.inventory}
                stock={getReflectionSessionStock(session)}
                selection={selection}
                selectedBoardPiece={
                  selection?.type === "cell"
                    ? (puzzleState.cells[selection.cellIndex] ?? null)
                    : null
                }
                disabled={interactionDisabled}
                onSelectStockPiece={(piece) => tap({ type: "stock", piece })}
                cues={cues}
              />
            ) : null}
          </div>
        }
        caption={captionContent}
      />
    </div>
  );
}

export const _private = { describeLight };

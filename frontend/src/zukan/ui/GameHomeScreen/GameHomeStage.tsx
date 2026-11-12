import { PlayIcon, ShuffleIcon } from "lucide-react";
import {
  type PointerEvent,
  type ReactNode,
  type Ref,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";

import { getGameResultStyle } from "@/components/game-result-style";
import type { ProblemFeature } from "@/components/problem-features";
import { Button } from "@/components/ui/button";
import type { ProblemId } from "@/games/problem-id";
import { getGameResultLevel } from "@/games/result";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { zukanProblemStatusLabels } from "@/zukan/ui/GameHomeScreen/zukan-problem-appearance";
import { formatZukanNumber } from "@/zukan/ui/zukan-number-format";
import {
  getZukanProblemStatus,
  type ZukanProblem,
  type ZukanSolvedProblem,
} from "@/zukan/zukan-collection";

type GameHomeStageProps = {
  /** これから遊ぶ1問。開いているレベルに出題できる問題が無いときは `null`。 */
  problem: ZukanProblem | null;
  numberDigitCount: number;
  /** 問題の、始めたときの盤面を見れば分かる特徴。求められなければ `null`。 */
  describeProblem: (problem: ZukanProblem) => readonly ProblemFeature[] | null;
  /** 問題の、始めたときの盤面を描く。描けなければ `null`。 */
  renderProblemPreview: (problem: ZukanProblem) => ReactNode | null;
  /** 盤面を描いている枠。プレイを始めるときに、この盤面を広げるのに使う。 */
  previewRef: Ref<HTMLDivElement>;
  /** 「別の問題」のボタン。変化を見せている間に押されたときに、そのまま引き直すのに使う。 */
  shuffleRef: Ref<HTMLButtonElement>;
  /** 「遊ぶ」か、盤面そのものを押したとき。 */
  onPlay: () => void;
  /** 「別の問題」を押したとき。 */
  onShuffle: () => void;
};

type SolvedProblemFact = { label: string; value: ReactNode };

/** 解いた問題の、次に挑むときの目標になる最も良い値。そのゲームで数えない値は並べない。最高スコアは別に示す。 */
function listSolvedProblemFacts(
  problem: ZukanSolvedProblem,
): SolvedProblemFact[] {
  const { fastestElapsedMs, fewestMoves, fewestMistakes } = problem;
  return [
    { label: "最速", value: formatElapsedTime(fastestElapsedMs) },
    ...(fewestMoves === null
      ? []
      : [
          {
            label: "最少",
            value: (
              <>
                {fewestMoves.completionMoveCount}手
                <span className="text-foreground/65">
                  （最短 {fewestMoves.optimalMoveCount}手）
                </span>
              </>
            ),
          },
        ]),
    ...(fewestMistakes === null
      ? []
      : [{ label: "ミス", value: `${fewestMistakes}回` }]),
  ];
}

/** 盤面を横へこの距離（px）より長く払ったら、押したのではなく、別の問題へ替える操作とみなす。 */
const SWIPE_DISTANCE_PX = 40;

/** 替わる前の盤面。新しい盤面と入れ替わりに薄れていく姿を描く。 */
type LeavingPreview = { problemId: ProblemId; preview: ReactNode };

/**
 * ゲームのホームの主役。これから遊ぶ1問の、始めたときの盤面を、プレイ画面と同じ姿でゲームの地の上に大きく見せ、その下に番号と始める操作を添える。
 * 番号と、盤面を見れば分かる特徴を示す。解かないと分からないことは示さない。難易度は、開いているレベルの帯が示す。
 * 解いた問題には、最高スコアと、最速タイム・最少手数・最少ミスのうちそのゲームが数える値を示す。最高スコアは結果画面の評価段階と同じ色の札で示し、称賛の言葉は付けない。
 * 問題が替わると、前の盤面が素早く消えてから新しい盤面が現れ、番号はすぐに替わる。台紙をなぞって次々に替えても待たせないよう、短く替える。
 * 盤面そのものを押しても、「遊ぶ」と同じく始められる。「別の問題」と、盤面を横へ払う操作は、開いているレベルからゲームが選んだ別の1問に替える。
 * 出題できる問題が無いときは、盤面の代わりにその旨を示す。「遊ぶ」と「別の問題」は、そのまま押せるようにしておき、押されたことを呼び出し側へ知らせる。
 */
export function GameHomeStage({
  problem,
  numberDigitCount,
  describeProblem,
  renderProblemPreview,
  previewRef,
  shuffleRef,
  onPlay,
  onShuffle,
}: GameHomeStageProps) {
  const [openedProblemId] = useState(problem?.problemId ?? null);
  const features = useMemo(
    () => (problem === null ? null : describeProblem(problem)),
    [problem, describeProblem],
  );
  const preview = useMemo(
    () => (problem === null ? null : renderProblemPreview(problem)),
    [problem, renderProblemPreview],
  );
  // 替わる前の盤面は、新しい盤面を描く同じ描画の中で控える。次の描画まで待つと、前の盤面が一度消えてから現れる。
  const [shown, setShown] = useState({ problem, preview });
  const [leaving, setLeaving] = useState<LeavingPreview | null>(null);
  if (shown.problem?.problemId !== problem?.problemId) {
    setLeaving(
      shown.problem === null
        ? null
        : { problemId: shown.problem.problemId, preview: shown.preview },
    );
    setShown({ problem, preview });
  }
  const isSwapped = problem?.problemId !== openedProblemId;
  // 前後の盤面の数字が二重に読めないよう、前の盤面が消えきってから新しい盤面を現す。番号は文字だけなので、すぐに替えて素早く現す。
  const swapInBoardClassName = isSwapped
    ? "animate-in duration-(--duration-fast) delay-(--duration-fast) ease-enter fill-mode-both fade-in zoom-in-[0.97] motion-reduce:animate-none"
    : "";

  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const hasSwipedRef = useRef(false);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    pressRef.current = { x: event.clientX, y: event.clientY };
    hasSwipedRef.current = false;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const press = pressRef.current;
    pressRef.current = null;
    if (press === null) {
      return;
    }
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (Math.abs(dx) > SWIPE_DISTANCE_PX && Math.abs(dx) > Math.abs(dy)) {
      // 払ったあとに続くクリックで、プレイを始めない。
      hasSwipedRef.current = true;
      onShuffle();
    }
  }

  function handleBoardClick() {
    if (hasSwipedRef.current) {
      hasSwipedRef.current = false;
      return;
    }
    handlePlay();
  }

  // 始めるときは、盤面の枠をまるごと写して動かす。写しの中では動きが止まるので、薄れていく前の盤面を先に消し、写す盤面を1つにする。
  function handlePlay() {
    flushSync(() => {
      setLeaving(null);
    });
    onPlay();
  }

  return (
    <section
      aria-label="これから遊ぶ問題"
      className="flex min-h-0 flex-1 flex-col gap-y-3"
    >
      {/* 盤面そのものを押しても始められる。同じ操作の「遊ぶ」があるので、キーと読み上げには出さない。盤面の中にボタンを持つゲームがあるので、ボタンにはしない。 */}
      <div
        role="presentation"
        aria-hidden="true"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onClick={handleBoardClick}
        className="flex min-h-0 flex-1 touch-pan-y items-center justify-center transition-[scale] duration-(--duration-fast) ease-standard cursor-pointer active:scale-[0.985]"
      >
        {/* 盤面の中にボタンを持つゲームがあるので、中の操作を止め、押したことは外側で受ける。 */}
        <div
          ref={previewRef}
          inert
          aria-hidden="true"
          className="relative flex size-full items-center justify-center [container-type:size]"
        >
          {problem === null ? (
            <p className="max-w-56 text-center text-supporting text-foreground/65">
              出題の条件に合う問題がありません
            </p>
          ) : (
            <div
              key={problem.problemId}
              className={`flex size-full items-center justify-center ${swapInBoardClassName}`}
            >
              {preview}
            </div>
          )}
          {leaving !== null && (
            <div
              key={leaving.problemId}
              data-leaving-preview=""
              onAnimationEnd={() => setLeaving(null)}
              className="absolute inset-0 flex animate-out items-center justify-center duration-(--duration-fast) ease-exit fill-mode-forwards fade-out motion-reduce:hidden"
            >
              {leaving.preview}
            </div>
          )}
        </div>
      </div>
      <div
        data-settle-chrome=""
        className="flex min-h-13 items-center justify-between gap-x-3"
      >
        {problem !== null && (
          <div key={problem.problemId} className="min-w-0">
            <p className="font-ui text-heading tabular-nums">
              {formatZukanNumber(problem.number, numberDigitCount)}
            </p>
            <dl className="flex flex-wrap items-center gap-x-2.5 text-meta text-foreground/65 tabular-nums">
              {problem.kind === "solved" ? (
                <>
                  <div className="flex items-center whitespace-nowrap">
                    <dt className="sr-only">最高スコア</dt>
                    <dd
                      className={`rounded-sm px-1.5 font-ui font-bold tabular-nums ${getGameResultStyle(getGameResultLevel(problem.bestScore)).markClassName}`}
                    >
                      {problem.bestScore}点
                    </dd>
                  </div>
                  {listSolvedProblemFacts(problem).map(({ label, value }) => (
                    <div key={label} className="flex gap-1 whitespace-nowrap">
                      <dt>{label}</dt>
                      <dd className="text-foreground">{value}</dd>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="whitespace-nowrap">
                    <dt className="sr-only">状態</dt>
                    <dd>
                      {zukanProblemStatusLabels[getZukanProblemStatus(problem)]}
                    </dd>
                  </div>
                  {features?.map(({ label, value }) => (
                    <div key={label} className="flex gap-1 whitespace-nowrap">
                      <dt>{label}</dt>
                      <dd className="text-foreground">{value}</dd>
                    </div>
                  ))}
                </>
              )}
            </dl>
          </div>
        )}
        <div className="ms-auto flex shrink-0 items-center gap-x-2">
          <Button
            ref={shuffleRef}
            variant="outline"
            size="icon-lg"
            aria-label="別の問題"
            onClick={onShuffle}
          >
            <ShuffleIcon aria-hidden="true" />
          </Button>
          <Button size="lg" onClick={handlePlay}>
            <PlayIcon aria-hidden="true" />
            遊ぶ
          </Button>
        </div>
      </div>
    </section>
  );
}

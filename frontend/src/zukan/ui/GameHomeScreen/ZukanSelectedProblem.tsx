import { PlayIcon, XIcon } from "lucide-react";
import { type ReactNode, type Ref, useMemo, useState } from "react";
import { flushSync } from "react-dom";

import { getGameResultStyle } from "@/components/game-result-style";
import type { ProblemFeature } from "@/components/problem-features";
import { Button } from "@/components/ui/button";
import type { ProblemId } from "@/games/problem-id";
import { getGameResultLevel } from "@/games/result";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { formatPlayedDate } from "@/lib/format-played-at";
import { zukanProblemStatusLabels } from "@/zukan/ui/GameHomeScreen/zukan-problem-appearance";
import { selectedProblemPartProps } from "@/zukan/ui/GameHomeScreen/zukan-selected-problem-motion";
import { formatZukanNumber } from "@/zukan/ui/zukan-number-format";
import {
  getZukanProblemStatus,
  type ZukanProblem,
  type ZukanSolvedProblem,
} from "@/zukan/zukan-collection";

type ZukanSelectedProblemProps = {
  /** ジグソーで選んでいる問題。 */
  problem: ZukanProblem;
  numberDigitCount: number;
  /** 問題の、始めたときの盤面を見れば分かる特徴。求められなければ `null`。 */
  describeProblem: (problem: ZukanProblem) => readonly ProblemFeature[] | null;
  /** 問題の、始めたときの盤面を描く。描けなければ `null`。 */
  renderProblemPreview: (problem: ZukanProblem) => ReactNode | null;
  /** 欄全体。ピースから盤面を広げて現す・ピースへ戻して閉じるのに使う。 */
  panelRef?: Ref<HTMLElement>;
  /** 盤面を描いている枠。プレイを始めるときに、この盤面を広げるのに使う。 */
  previewRef: Ref<HTMLDivElement>;
  /** 「遊ぶ」か、盤面そのものを押したとき。 */
  onPlay: () => void;
  /** 閉じるボタンを押したとき。 */
  onClose: () => void;
};

type SolvedProblemFact = { label: string; value: ReactNode };

/** 解いた問題の、次に挑むときの目標になる最も良い値と、初めてクリアした日。そのゲームで数えない値は並べない。最高スコアは別に示す。 */
function listSolvedProblemFacts(
  problem: ZukanSolvedProblem,
): SolvedProblemFact[] {
  const { fastestElapsedMs, fewestMoves, fewestMistakes } = problem;
  return [
    { label: "最速タイム", value: formatElapsedTime(fastestElapsedMs) },
    ...(fewestMoves === null
      ? []
      : [
          {
            label: "最少手数",
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
      : [{ label: "最少ミス", value: `${fewestMistakes}回` }]),
    { label: "初クリア", value: formatPlayedDate(problem.firstClearedAt) },
  ];
}

/** 替わる前の盤面。新しい盤面と入れ替わりに薄れていく姿を描く。 */
type LeavingPreview = { problemId: ProblemId; preview: ReactNode };

/**
 * ジグソーで選んだ1問。ピースを選んだときにだけ、その問題の始めたときの盤面をプレイ画面と同じ姿で見せ、始める操作を添える。
 * 番号と、盤面を見れば分かる特徴を示す。解かないと分からないことは示さない。難易度は、開いているレベルのカードが示す。
 * 解いた問題には、最高スコアと、最速タイム・最少手数・最少ミスのうちそのゲームが数える値を示す。最高スコアは結果画面の評価段階と同じ色の札で示し、称賛の言葉は付けない。
 * スマートフォンでは盤面を左に、番号と操作を右に並べて、ジグソーの下に置く。PC では盤面を上に、番号と操作を下に並べて、ジグソーの横に置く。
 * 選ぶ問題を替えると、前の盤面が素早く消えてから新しい盤面が現れ、番号はすぐに替わる。選び替えを続けても待たせないよう、短く替える。
 * 盤面そのものを押しても、「遊ぶ」と同じく始められる。
 */
export function ZukanSelectedProblem({
  problem,
  numberDigitCount,
  describeProblem,
  renderProblemPreview,
  panelRef,
  previewRef,
  onPlay,
  onClose,
}: ZukanSelectedProblemProps) {
  const [openedProblemId] = useState(problem.problemId);
  const features = useMemo(
    () => describeProblem(problem),
    [problem, describeProblem],
  );
  const preview = useMemo(
    () => renderProblemPreview(problem),
    [problem, renderProblemPreview],
  );
  // 替わる前の盤面は、新しい盤面を描く同じ描画の中で控える。次の描画まで待つと、前の盤面が一度消えてから現れる。
  const [shown, setShown] = useState({ problem, preview });
  const [leaving, setLeaving] = useState<LeavingPreview | null>(null);
  if (shown.problem.problemId !== problem.problemId) {
    setLeaving({
      problemId: shown.problem.problemId,
      preview: shown.preview,
    });
    setShown({ problem, preview });
  }
  const isSwapped = problem.problemId !== openedProblemId;
  // 前後の盤面の数字が二重に読めないよう、前の盤面が消えきってから新しい盤面を現す。番号は文字だけなので、すぐに替えて素早く現す。
  const swapInBoardClassName = isSwapped
    ? "animate-in duration-(--duration-fast) delay-(--duration-fast) ease-enter fill-mode-both fade-in motion-reduce:animate-none"
    : "";
  const swapInInfoClassName = isSwapped
    ? "animate-in duration-(--duration-fast) ease-enter fill-mode-both fade-in-60 motion-reduce:animate-none"
    : "";

  // 始めるときと閉じるときは、盤面の枠をまるごと写して動かす。写しの中では動きが止まるので、薄れていく前の盤面を先に消し、写す盤面を1つにする。
  function dismissLeaving() {
    flushSync(() => {
      setLeaving(null);
    });
  }

  function handlePlay() {
    dismissLeaving();
    onPlay();
  }

  function handleClose() {
    dismissLeaving();
    onClose();
  }

  return (
    <aside
      ref={panelRef}
      aria-label="選んだ問題"
      // 狭い画面では、ジグソーの下端に重ねる面にする。ジグソーの領域を縮めると、ピースが組み直されるため。
      className="grid grid-cols-[--spacing(34)_minmax(0,1fr)] gap-x-4 max-lg:rounded-t-lg max-lg:bg-(--browser-surface,var(--background)) max-lg:px-4 max-lg:pt-4 max-lg:pb-3 max-lg:shadow-[0_-10px_24px_-10px_rgb(0_0_0/0.35)] lg:grid-cols-1 lg:gap-y-4"
    >
      {/* 盤面そのものを押しても始められる。同じ操作の「遊ぶ」があるので、キーと読み上げには出さない。盤面の中にボタンを持つゲームがあるので、ボタンにはしない。 */}
      <div
        {...selectedProblemPartProps("board")}
        role="presentation"
        aria-hidden="true"
        onClick={handlePlay}
        className="aspect-square w-full cursor-pointer transition-[scale] duration-(--duration-fast) ease-standard active:scale-[0.985]"
      >
        {/* 盤面の中にボタンを持つゲームがあるので、中の操作を止め、押したことは外側で受ける。 */}
        <div
          ref={previewRef}
          inert
          aria-hidden="true"
          className="relative flex size-full items-center justify-center [container-type:size]"
        >
          <div
            key={problem.problemId}
            className={`flex size-full items-center justify-center ${swapInBoardClassName}`}
          >
            {preview}
          </div>
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
        {...selectedProblemPartProps("info")}
        data-settle-chrome=""
        className="flex min-w-0 flex-col justify-between gap-y-2"
      >
        <div key={problem.problemId} className={swapInInfoClassName}>
          <div className="flex items-center justify-between gap-x-2">
            <p className="font-ui text-heading tabular-nums">
              {formatZukanNumber(problem.number, numberDigitCount)}
            </p>
            {/* 閉じるアイコンの線を右端にそろえるよう、ボタンの内側の余白の分だけ外へ出す。 */}
            <span className="-me-2 flex">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="閉じる"
                onClick={handleClose}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </span>
          </div>
          <dl className="flex flex-wrap gap-x-3 text-meta text-foreground/65 tabular-nums">
            {features?.map(({ label, value }) => (
              <div key={label} className="flex gap-1 whitespace-nowrap">
                <dt>{label}</dt>
                <dd className="text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          {problem.kind === "solved" ? (
            <dl className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-meta text-foreground/65 tabular-nums">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <dt>最高スコア</dt>
                <dd
                  className={`rounded-sm px-1.5 font-ui tabular-nums font-bold ${getGameResultStyle(getGameResultLevel(problem.bestScore)).markClassName}`}
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
            </dl>
          ) : (
            <p className="mt-1 text-meta text-foreground/65">
              {zukanProblemStatusLabels[getZukanProblemStatus(problem)]}
            </p>
          )}
        </div>
        <Button size="lg" onClick={handlePlay}>
          <PlayIcon aria-hidden="true" />
          遊ぶ
        </Button>
      </div>
    </aside>
  );
}

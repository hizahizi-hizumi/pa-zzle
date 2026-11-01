import { PlayIcon, XIcon } from "lucide-react";
import {
  type AnimationEvent,
  type ReactNode,
  type RefObject,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import { withPlayStartSound } from "@/components/app-decision-sound";
import { DifficultyLevelPieces } from "@/components/DifficultyLevelPieces";
import { getGameResultStyle } from "@/components/game-result-style";
import type { ProblemFeature } from "@/components/problem-features";
import { Button } from "@/components/ui/button";
import { getDifficultyLabel } from "@/games/difficulty";
import { getGameResultLevel } from "@/games/result";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { formatPlayedDate } from "@/lib/format-played-at";
import {
  formatZukanNumber,
  zukanProblemStatusLabels,
} from "@/zukan/ui/GameHomeScreen/zukan-problem-appearance";
import {
  getZukanProblemStatus,
  type ZukanProblem,
  type ZukanSolvedProblem,
} from "@/zukan/zukan-collection";

type ZukanProblemDetailProps = {
  /** 詳細を描いている間の要素。閉じる動きの間も描き、閉じ終えると `null` になる。 */
  ref: RefObject<HTMLElement | null>;
  /** 重ねて覆う台紙のスクロール領域。重ねるときは、この領域の上端からマスの数行分を覆わない高さに収め、収まらない中身はスクロールさせる。 */
  coverLimitRef: RefObject<HTMLElement | null>;
  /** 台紙で選んでいる問題。選んでいなければ `null` で、詳細を閉じる。 */
  problem: ZukanProblem | null;
  numberDigitCount: number;
  /** 問題の、始めたときの盤面を見れば分かる特徴。求められなければ `null`。 */
  describeProblem: (problem: ZukanProblem) => readonly ProblemFeature[] | null;
  onPlay: (problem: ZukanProblem) => void;
  /** 閉じるボタンを押したとき。 */
  onClose: () => void;
  /** 台紙の下端に重ねている高さ（px）が変わったとき。重ねていないときは 0。 */
  onOverlayHeightChange: (height: number) => void;
};

/** 詳細を台紙の下端に重ねて出す画面幅。クラスの `lg:` で台紙の横へ移すのと同じ境目にする。 */
const OVERLAY_MEDIA_QUERY = "(width < 64rem)";

function isOverlayingSheet(): boolean {
  return window.matchMedia?.(OVERLAY_MEDIA_QUERY).matches ?? false;
}

/** 重ねるときに、台紙のスクロール領域の上端から覆わずに残す高さ（px）。台紙の上の余白と、選んだマスを含むマスの3行ほど。 */
const UNCOVERED_SHEET_HEIGHT_PX = 64;

/** 重ねる詳細の最低の高さ。解いた問題の詳細が収まる高さで、選ぶ問題を変えても縁が動かないようにする。 */
const MIN_OVERLAY_HEIGHT = "8rem";

/** 重ねる詳細の高さの上限を、台紙のスクロール領域の上端から決める。重ねない幅では上限を外す。 */
function limitOverlayHeight(
  element: HTMLElement,
  coverLimit: HTMLElement | null,
) {
  if (!isOverlayingSheet() || coverLimit === null) {
    element.style.maxHeight = "";
    element.style.minHeight = "";
    return;
  }
  // 出し入れの動きで要素自身は動くので、下端をそろえて置いている囲みの下端を使う。
  const bottom = (element.offsetParent ?? element).getBoundingClientRect()
    .bottom;
  const top =
    coverLimit.getBoundingClientRect().top + UNCOVERED_SHEET_HEIGHT_PX;
  const maxHeight = `${Math.max(bottom - top, 0)}px`;
  element.style.maxHeight = maxHeight;
  // 選ぶ問題で縁を動かさないよう取っている最低の高さより、台紙を残す上限を優先する。
  element.style.minHeight = `min(${MIN_OVERLAY_HEIGHT}, ${maxHeight})`;
}

function hasRunningAnimation(element: HTMLElement): boolean {
  const { animationName } = getComputedStyle(element);
  return animationName !== "" && animationName !== "none";
}

type SolvedProblemFact = { label: string; value: ReactNode };

const factValueClassName = "font-mono text-supporting text-foreground";

/** 解いた問題の、次に挑むときの目標になる最も良い値と、初めてクリアした日。そのゲームで数えない値は並べない。 */
function listSolvedProblemFacts(
  problem: ZukanSolvedProblem,
): SolvedProblemFact[] {
  const { bestScore, fastestElapsedMs, fewestMoves, fewestMistakes } = problem;
  return [
    {
      label: "最高スコア",
      value: (
        <span
          className={`rounded-full px-2 font-mono text-supporting font-bold ${getGameResultStyle(getGameResultLevel(bestScore)).markClassName}`}
        >
          {bestScore}点
        </span>
      ),
    },
    {
      label: "最速タイム",
      value: (
        <span className={factValueClassName}>
          {formatElapsedTime(fastestElapsedMs)}
        </span>
      ),
    },
    ...(fewestMoves === null
      ? []
      : [
          {
            label: "最少手数",
            value: (
              <>
                <span className={factValueClassName}>
                  {fewestMoves.completionMoveCount}手
                </span>
                <span>（最短 {fewestMoves.optimalMoveCount}手）</span>
              </>
            ),
          },
        ]),
    ...(fewestMistakes === null
      ? []
      : [
          {
            label: "最少ミス",
            value: (
              <span className={factValueClassName}>{fewestMistakes}回</span>
            ),
          },
        ]),
    { label: "初クリア", value: formatPlayedDate(problem.firstClearedAt) },
  ];
}

/**
 * 台紙で選んだ1問の詳細と、その問題を始める操作。選んでいる間だけ描く。
 * スマートフォンでは台紙の下端に重ね、下から短く滑らせて出し入れし、重ねた高さを知らせる。選ぶ問題を変えても縁が動かないよう、解いた問題の詳細が収まる高さを保つ。PC では台紙の横に置き、動かさない。
 * 閉じるボタンは始める操作と並べる。PC の狭い列では番号と難易度の行に並べると難易度が折り返すので、始める操作の横に置く。
 * 番号と難易度の下に、始めたときの盤面を見れば分かる問題の特徴を、解いたかどうかによらず小さく示す。解かないと分からないことは示さない。
 * 解いた問題には、最高スコアと、最速タイム・最少手数・最少ミスのうちそのゲームが数える値を示す。最高スコアは結果画面の評価段階と同じ色の札で示し、称賛の言葉は付けない。
 * 難易度の名前は、番号の行に収まらない狭い幅では、途中で折り返さずに次の行へ送る。
 * 名前と値の組は、スマートフォンでは2組ずつ、PC では1組ずつの列に揃え、組の途中で折り返さない。値の補足（最短手数）は、収まらない幅では値の下へ送る。
 * 低い画面で台紙を覆い尽くさないよう、重ねるときは台紙の上端からマスの数行を覆わない高さに収め、収まらない中身は詳細の中でスクロールさせる。
 */
export function ZukanProblemDetail({
  ref,
  coverLimitRef,
  problem,
  numberDigitCount,
  describeProblem,
  onPlay,
  onClose,
  onOverlayHeightChange,
}: ZukanProblemDetailProps) {
  // 閉じる動きの間も中身を残すよう、最後に選んでいた問題を閉じ終えるまで持つ。
  const [shownProblem, setShownProblem] = useState(problem);
  if (problem !== null && problem !== shownProblem) {
    setShownProblem(problem);
  }
  const isClosing = problem === null;
  // 画面を開いたときに選んでおいた問題は、画面と一緒に出ているものとして滑らせて出さない。一度閉じたら、次からは滑らせる。
  const [entersWithMotion, setEntersWithMotion] = useState(problem === null);
  if (isClosing && !entersWithMotion) {
    setEntersWithMotion(true);
  }
  const features = useMemo(
    () => (shownProblem === null ? null : describeProblem(shownProblem)),
    [shownProblem, describeProblem],
  );
  const reportOverlayHeight = useEffectEvent(onOverlayHeightChange);

  // 閉じる動きの無い幅や動きを減らす設定では、閉じたらすぐ描くのをやめる。
  useLayoutEffect(() => {
    const element = ref.current;
    if (isClosing && (element === null || !hasRunningAnimation(element))) {
      setShownProblem(null);
    }
  }, [isClosing, ref]);

  // 閉じ始めたら重ねていないものとし、閉じる動きと一緒に台紙を下ろせるようにする。
  // 出した直後の高さは描く前に知らせ、台紙が選んだマスへ一度で寄せられるようにする。以後の高さの変わりは ResizeObserver で追う。
  useLayoutEffect(() => {
    const element = ref.current;
    if (isClosing || element === null) {
      return;
    }
    function reportHeight(height: number) {
      reportOverlayHeight(isOverlayingSheet() ? height : 0);
    }
    function limitHeight() {
      if (element !== null) {
        limitOverlayHeight(element, coverLimitRef.current);
      }
    }
    limitHeight();
    reportHeight(element.getBoundingClientRect().height);
    const observer = new ResizeObserver(([entry]) => {
      reportHeight(entry?.borderBoxSize[0]?.blockSize ?? 0);
    });
    observer.observe(element);
    window.addEventListener("resize", limitHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", limitHeight);
      reportOverlayHeight(0);
    };
  }, [isClosing, ref, coverLimitRef]);

  function handleAnimationEnd(event: AnimationEvent<HTMLElement>) {
    if (isClosing && event.target === event.currentTarget) {
      setShownProblem(null);
    }
  }

  if (shownProblem === null) {
    return null;
  }

  return (
    <aside
      ref={ref}
      aria-label="選んだ問題"
      onAnimationEnd={handleAnimationEnd}
      className={`absolute -inset-x-4 bottom-0 z-10 overflow-y-auto overscroll-contain border-t-(length:--border-width-normal) bg-background px-4 pt-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))] duration-(--duration-normal) motion-reduce:animate-none sm:-inset-x-6 sm:px-6 lg:static lg:min-h-0 lg:animate-none lg:self-start lg:overflow-visible lg:rounded-lg lg:border-(length:--border-width-normal) lg:p-4 ${isClosing ? "pointer-events-none animate-out ease-exit fill-mode-forwards slide-out-to-bottom" : entersWithMotion ? "animate-in ease-enter slide-in-from-bottom" : ""}`}
    >
      <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-y-4">
        <div className="min-w-0 lg:col-span-full">
          <p className="flex flex-wrap items-center gap-x-2">
            <span className="flex items-center gap-2">
              <span className="font-mono text-supporting tabular-nums">
                {formatZukanNumber(shownProblem.number, numberDigitCount)}
              </span>
              <DifficultyLevelPieces level={shownProblem.difficulty} />
            </span>
            <span className="whitespace-nowrap text-meta text-muted-foreground">
              {getDifficultyLabel(shownProblem.difficulty)}
            </span>
          </p>
          {features !== null && features.length > 0 && (
            <dl className="flex flex-wrap gap-x-3 text-meta text-muted-foreground tabular-nums">
              {features.map(({ label, value }) => (
                <div key={label} className="flex gap-1 whitespace-nowrap">
                  <dt>{label}</dt>
                  <dd className="text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="lg:order-last lg:grid">
          <Button onClick={withPlayStartSound(() => onPlay(shownProblem))}>
            <PlayIcon aria-hidden="true" />
            遊ぶ
          </Button>
        </div>
        <div className="lg:order-last">
          <Button
            variant="ghost"
            size="icon"
            aria-label="閉じる"
            onClick={onClose}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
        {shownProblem.kind === "solved" ? (
          <dl className="col-span-full grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 text-meta text-muted-foreground tabular-nums min-[360px]:grid-cols-[auto_auto_auto_minmax(0,1fr)] min-[360px]:gap-x-3 lg:grid-cols-[auto_minmax(0,1fr)]">
            {listSolvedProblemFacts(shownProblem).map(({ label, value }) => (
              <div
                key={label}
                className="col-span-2 grid grid-cols-subgrid items-center"
              >
                <dt>{label}</dt>
                <dd className="flex flex-wrap items-baseline justify-self-start whitespace-nowrap">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="col-span-full text-supporting text-muted-foreground">
            {zukanProblemStatusLabels[getZukanProblemStatus(shownProblem)]}
          </p>
        )}
      </div>
    </aside>
  );
}

import { Shuffle } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";

import { playPlayStartSound } from "@/components/app-decision-sound";
import type { HowToPlayDialogControl } from "@/components/HowToPlayDialog";
import type {
  ProblemFeature,
  ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { type DifficultyLevel, parseDifficultyLevel } from "@/games/difficulty";
import type { ProblemFeatureValue } from "@/games/problem-feature";
import type { ProblemId } from "@/games/problem-id";
import {
  isDocumentVisible as readDocumentVisible,
  subscribeDocumentVisibility,
} from "@/lib/document-visibility";
import {
  prefersReducedMotion as readPrefersReducedMotion,
  subscribePrefersReducedMotion,
} from "@/lib/motion";
import type { PlayRecord } from "@/records/play-record";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";
import { GameHomeHeading } from "@/zukan/ui/GameHomeScreen/GameHomeHeading";
import { GameHomeMenu } from "@/zukan/ui/GameHomeScreen/GameHomeMenu";
import { GameHomePerformance } from "@/zukan/ui/GameHomeScreen/GameHomePerformance";
import {
  type GameLevelCard,
  GameLevelCards,
} from "@/zukan/ui/GameHomeScreen/GameLevelCards";
import {
  type GameHomeLayer,
  useGameHomeLayers,
} from "@/zukan/ui/GameHomeScreen/use-game-home-layers";
import {
  useZukanChangeReveal,
  type ZukanStampProgress,
} from "@/zukan/ui/GameHomeScreen/use-zukan-change-reveal";
import { ZukanFilter } from "@/zukan/ui/GameHomeScreen/ZukanFilter";
import { ZukanLegend } from "@/zukan/ui/GameHomeScreen/ZukanLegend";
import { ZukanMatchedCount } from "@/zukan/ui/GameHomeScreen/ZukanMatchedCount";
import {
  isZukanDetailOverlayingSheet,
  ZukanProblemDetail,
} from "@/zukan/ui/GameHomeScreen/ZukanProblemDetail";
import {
  countZukanSheetColumns,
  ZukanProblemSheet,
} from "@/zukan/ui/GameHomeScreen/ZukanProblemSheet";
import { ZukanProblemStatusCounts } from "@/zukan/ui/GameHomeScreen/ZukanProblemStatusCounts";
import {
  countZukanNewlySolved,
  getZukanShownProblemStatus,
  getZukanStampSlot,
  type ZukanChangeAppearance,
  type ZukanChangeStage,
} from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";
import type { ZukanFilterFeatureAxis } from "@/zukan/ui/GameHomeScreen/zukan-filter-appearance";
import { getZukanPiecePath } from "@/zukan/ui/GameHomeScreen/zukan-piece-shape";
import { playZukanPlayEntry } from "@/zukan/ui/GameHomeScreen/zukan-play-entry";
import { getZukanNumberDigitCount } from "@/zukan/ui/zukan-number-format";
import {
  countZukanProblemsByStatus,
  type GameZukan,
  type ZukanDifficultySection,
  type ZukanProblem,
  type ZukanProblemStatus,
} from "@/zukan/zukan-collection";
import {
  arrangeZukanProblems,
  countZukanFilterConditions,
  countZukanFilterOptions,
  createZukanFilterMatcher,
  createZukanLevelFeaturesCache,
  hasZukanFeatureConditions,
  listZukanPerformanceAxes,
  noZukanFilterConditions,
  type ZukanArrangement,
  type ZukanFeatureAxisSource,
  type ZukanFilterConditions,
  type ZukanLevelFeatures,
} from "@/zukan/zukan-filter";
import type {
  ZukanChanges,
  ZukanProblemChange,
} from "@/zukan/zukan-last-viewed";
import {
  findZukanMilestoneProgress,
  isZukanMilestone,
} from "@/zukan/zukan-milestone";

export type ZukanFeatureAxis = ZukanFeatureAxisSource & {
  display: ProblemFeatureAxisDisplay;
};

export type GameHomeScreenProps = {
  gameId: string;
  gameTitle: string;
  pictogramSvg: string;
  /** 色と動きのあるピクトグラム。無ければ `pictogramSvg` を見せる。 */
  pictogramShowcaseSvg?: string;
  ground: ReactNode;
  zukan: GameZukan;
  /** レベルのカードに添える、そのレベルの中身の一言。 */
  levelSummaries: Readonly<Record<DifficultyLevel, string>>;
  changes: ZukanChanges;
  /**
   * レベルの変化を見せ終えたとき。最後まで押したとき・飛ばしたとき・押している途中で別のレベルへ切り替えたときと、
   * 動きを減らす設定で印を載せた台紙を見せたとき。画面を離れて演出をやめたときは呼ばない。
   */
  onLevelChangesShown: (difficulty: DifficultyLevel) => void;
  initialSelectedProblemId: ProblemId | null;
  /**
   * レベルの問題から、新しいプレイを始める問題をゲームが選ぶ。出題条件に合う問題が無ければ、そのことを知らせて `null` を返す。
   * 選んだ問題は `onPlayProblem` で始める。
   */
  pickRandomProblemId: (difficulty: DifficultyLevel) => ProblemId | null;
  onPlayProblem: (problem: ZukanProblem) => void;
  /** 問題の、始めたときの盤面を見れば分かる特徴。詳細を出す1問についてだけ求める。求められなければ `null`。 */
  describeProblem: (problem: ZukanProblem) => readonly ProblemFeature[] | null;
  /** 絞り込みに使う、問題の特徴の軸。示す順。 */
  featureAxes: readonly ZukanFeatureAxis[];
  /**
   * 問題の、絞り込みに使う特徴の値を軸の ID ごとに返す。求められなければ `null`。
   * 絞り込みを開いたときか特徴の条件をかけたときに、開いているレベルの全問について、レベルごとに一度だけ求める。
   */
  findProblemFeatureValues: (
    problem: ZukanProblem,
  ) => ReadonlyMap<string, ProblemFeatureValue> | null;
  renderHowToPlayDialog: (control: HowToPlayDialogControl) => ReactNode;
  /** 渡したゲームでは、まだ1問もクリアしていない人が始める操作をすると、プレイの前にチュートリアルを開く。 */
  renderTutorial?: (control: GameHomeTutorialControl) => ReactNode;
  /** 全記録。開いているレベルの成績（自己ベスト・推移）と、このゲームをクリアしたことがあるかを、この中から求める。 */
  records: readonly PlayRecord[];
  playRecordDisplay: PlayRecordDisplayDefinition;
};

export type GameHomeTutorialControl = HowToPlayDialogControl & {
  playStart: TutorialPlayStart;
};

type SelectedProblemKey = { difficulty: DifficultyLevel; problemId: ProblemId };

type SelectedProblem = { problem: ZukanProblem; index: number };

/**
 * チュートリアルを終えて始めるプレイ。
 * - `random`: 開いているレベルからゲームが選んだ問題。メニューから開いたときと、「ランダムに遊ぶ」から開いたとき。
 * - `problem`: 詳細から始めようとした問題。
 */
type TutorialPlayTarget =
  | { kind: "random" }
  | { kind: "problem"; problem: ZukanProblem };

const randomTutorialPlayTarget: TutorialPlayTarget = { kind: "random" };

type LevelFilter = {
  difficulty: DifficultyLevel | null;
  conditions: ZukanFilterConditions;
};

const noLevelFilter: LevelFilter = {
  difficulty: null,
  conditions: noZukanFilterConditions,
};

/**
 * 離脱の保存で図鑑が導き直されても、絞り込みで並びが変わっても選んだ問題を保つよう、選択は問題 ID で持ち、今の台紙の問題から引き直す。
 * 位置は台紙に番号の順で置いた中の位置。
 */
function findSelectedProblem(
  difficulty: DifficultyLevel,
  problems: readonly ZukanProblem[],
  key: SelectedProblemKey | null,
): SelectedProblem | null {
  if (difficulty !== key?.difficulty) {
    return null;
  }
  const index = problems.findIndex(
    ({ problemId }) => problemId === key.problemId,
  );
  const problem = problems[index];
  return problem ? { problem, index } : null;
}

const noProblems: readonly ZukanProblem[] = [];

const noStatuses: readonly ZukanProblemStatus[] = [];

function listShownStatuses(
  problems: readonly ZukanProblem[],
  pendingChanges: ReadonlyMap<ProblemId, ZukanProblemChange> | undefined,
): ZukanProblemStatus[] {
  return problems.map((problem) =>
    getZukanShownProblemStatus(problem, pendingChanges?.get(problem.problemId)),
  );
}

const INITIAL_SHEET_WIDTH_PX = 320;

/**
 * 高さが分かる前の詳細が台紙を覆う高さの見込み（px）。
 * 重ねる詳細の最低の高さ（`ZukanProblemDetail` の 8rem）から、詳細が一緒に覆う「ランダムに遊ぶ」の行の高さ（`size="lg"` のボタンの 2.5rem と、上の余白の `mt-2`）を引いた値。
 */
const PENDING_DETAIL_COVER_HEIGHT_PX = 80;

function getOuterHeight(row: HTMLElement | null): number {
  return row === null
    ? 0
    : row.offsetHeight + Number.parseFloat(getComputedStyle(row).marginTop);
}

function findSquareElement(
  scroller: HTMLElement | null,
  index: number,
): HTMLElement | null {
  return (
    scroller?.querySelector<HTMLElement>(`[data-index="${index}"]`) ?? null
  );
}

function arrangeOpenProblems(
  problems: readonly ZukanProblem[],
  conditions: ZukanFilterConditions,
  levelFeatures: ZukanLevelFeatures | null,
): ZukanArrangement {
  return countZukanFilterConditions(conditions) === 0
    ? { problems, matchedCount: problems.length }
    : arrangeZukanProblems(
        problems,
        createZukanFilterMatcher(conditions, levelFeatures),
      );
}

function listFilterFeatureAxes(
  levelFeatures: ZukanLevelFeatures | null,
  featureAxes: readonly ZukanFeatureAxis[],
): ZukanFilterFeatureAxis[] {
  return (levelFeatures?.axes ?? []).flatMap(({ axisId, options }) => {
    const axis = featureAxes.find(({ id }) => id === axisId);
    return axis ? [{ axisId, display: axis.display, options }] : [];
  });
}

/**
 * 離脱はこの画面を描いたあとに保存されることがあるので、選ぶまでは図鑑から求め直す。
 */
function findOpenSection(
  sections: readonly ZukanDifficultySection[],
  chosenDifficulty: DifficultyLevel | null,
  latestPlayedDifficulty: DifficultyLevel | null,
): ZukanDifficultySection {
  const openSection =
    sections.find(({ difficulty }) => difficulty === chosenDifficulty) ??
    sections.find(({ difficulty }) => difficulty === latestPlayedDifficulty) ??
    sections[0];
  // どのゲームも難易度1〜5のそれぞれに問題を供給するので（難易度提供の採用条件）、問題のあるレベルが無いのは問題集の誤りである。
  if (openSection === undefined) {
    throw new Error("ゲームのホームを開くには、問題のあるレベルが要る");
  }
  return openSection;
}

function findProblemKey(
  sections: readonly ZukanDifficultySection[],
  problemId: ProblemId | null,
): SelectedProblemKey | null {
  const problem = sections
    .flatMap(({ problems }) => problems)
    .find((candidate) => candidate.problemId === problemId);
  return problem
    ? { difficulty: problem.difficulty, problemId: problem.problemId }
    : null;
}

/**
 * レベルの変化を見せたあとの扱い。
 * - `marked`: 動きを減らす設定で印を載せて見せた。開いている間は印を残し、設定が変わっても押していく演出はしない。
 * - `done`: 見せ終えた。今の姿で描く。
 * 持たないレベルは、まだ変化を見せていない。
 */
type LevelRevealStatus = "marked" | "done";

/** 押していく順（番号の順）に並べた、台紙で変化したマスの番号の順の位置。 */
function listChangeIndices(
  problems: readonly ZukanProblem[],
  changes: ReadonlyMap<ProblemId, ZukanProblemChange>,
): number[] {
  return problems.flatMap(({ problemId }, index) =>
    changes.has(problemId) ? [index] : [],
  );
}

function getStampStage(
  order: number,
  { startedSlotCount, landedSlotCount }: ZukanStampProgress,
): ZukanChangeStage {
  const slot = getZukanStampSlot(order);
  if (slot < landedSlotCount) {
    return "landed";
  }
  return slot < startedSlotCount ? "stamping" : "waiting";
}

function listChangeStages(
  problems: readonly ZukanProblem[],
  changeIndices: readonly number[],
  appearance: ZukanChangeAppearance,
  progress: ZukanStampProgress,
): ReadonlyMap<ProblemId, ZukanChangeStage> {
  return new Map(
    changeIndices.flatMap((index, order) => {
      const problem = problems[index];
      return problem === undefined
        ? []
        : [
            [
              problem.problemId,
              appearance === "marked"
                ? "marked"
                : getStampStage(order, progress),
            ] as const,
          ];
    }),
  );
}

/**
 * 押していくと、そのレベルの解いた数が節目に届く問題。押す順に新しく解いた問題を数え、前回の解いた数に足して最初に節目に届くもの。
 * 1回で節目を2つ以上越えるときも、最初に届いた節目の1問だけを強く押す。
 */
function findMilestoneProblemId(
  problems: readonly ZukanProblem[],
  changeIndices: readonly number[],
  changes: ReadonlyMap<ProblemId, ZukanProblemChange>,
  solvedCount: number,
): ProblemId | null {
  let shownSolvedCount = solvedCount - countZukanNewlySolved(changes);
  for (const index of changeIndices) {
    const problemId = problems[index]?.problemId;
    if (
      problemId === undefined ||
      changes.get(problemId)?.kind !== "newly-solved"
    ) {
      continue;
    }
    shownSolvedCount += 1;
    if (isZukanMilestone(shownSolvedCount, problems.length)) {
      return problemId;
    }
  }
  return null;
}

/** まだマスに着いていない変化。今の数から引いて、前回の数から数え上げて見せるのに使う。 */
function listPendingChanges(
  changes: ReadonlyMap<ProblemId, ZukanProblemChange> | undefined,
  stages: ReadonlyMap<ProblemId, ZukanChangeStage> | undefined,
): ReadonlyMap<ProblemId, ZukanProblemChange> {
  return new Map(
    [...(changes ?? [])].filter(([problemId]) => {
      const stage = stages?.get(problemId);
      return stage === "waiting" || stage === "stamping";
    }),
  );
}

/**
 * 画面の高さに収め、台紙だけをスクロールさせる。
 * 前回図鑑を見たときからの変化を見せるときは、台紙と数と縮図を前回の姿で描き始め、変化したマスを1つずつ押していき、押してマスに着くたびに、そのレベルのカードの数と縮図・状態ごとの数・解いた数を今の姿へ進める。
 */
export function GameHomeScreen({
  gameId,
  gameTitle,
  pictogramSvg,
  pictogramShowcaseSvg,
  zukan,
  levelSummaries,
  changes,
  ground,
  initialSelectedProblemId,
  pickRandomProblemId,
  onPlayProblem,
  describeProblem,
  onLevelChangesShown,
  featureAxes,
  findProblemFeatureValues,
  renderHowToPlayDialog,
  renderTutorial,
  records,
  playRecordDisplay,
}: GameHomeScreenProps) {
  const [initialSelectedKey] = useState(() =>
    findProblemKey(zukan.sections, initialSelectedProblemId),
  );
  // 選んでおく問題のレベルは、利用者が選んだレベルと同じく、最後に遊んだレベルが変わっても開いたままにする。
  const [chosenDifficulty, setChosenDifficulty] =
    useState<DifficultyLevel | null>(initialSelectedKey?.difficulty ?? null);
  const [selectedKey, setSelectedKey] = useState<SelectedProblemKey | null>(
    initialSelectedKey,
  );
  const [levelFilter, setLevelFilter] = useState<LevelFilter>(noLevelFilter);
  const { openLayer, menuButtonRef, changeLayerOpen } = useGameHomeLayers();
  const isFilterOpen = openLayer === "filter";
  // 選択肢ごとの数は絞り込みを開くまで見せないので、開くまで数えず、ゲームのホームを開くまでの時間を縮める。閉じる動きの間も数を保つよう、一度開いたら数え続ける。
  const [hasOpenedFilter, setHasOpenedFilter] = useState(false);
  const [revealStatuses, setRevealStatuses] = useState<
    ReadonlyMap<DifficultyLevel, LevelRevealStatus>
  >(() => new Map());
  // 描いている間に動きを減らす設定が変わったり、ページが裏へ回ったり戻ったりしても追従する。
  const prefersReducedMotion = useSyncExternalStore(
    subscribePrefersReducedMotion,
    readPrefersReducedMotion,
  );
  const isDocumentVisible = useSyncExternalStore(
    subscribeDocumentVisibility,
    readDocumentVisible,
  );
  // 詳細が台紙を覆う高さ。開いてから一度も詳細の高さが分かっていない間は `null`。
  const [detailOverlayHeight, setDetailOverlayHeight] = useState<number | null>(
    null,
  );
  const [isEnteringPlay, setIsEnteringPlay] = useState(false);
  const [tutorialPlayTarget, setTutorialPlayTarget] =
    useState<TutorialPlayTarget>(randomTutorialPlayTarget);
  // 台紙を描いて幅が分かるまでは、狭い画面の台紙に近い幅で縮図を並べる。
  const [sheetWidthPx, setSheetWidthPx] = useState(INITIAL_SHEET_WIDTH_PX);
  const screenRef = useRef<HTMLDivElement>(null);
  const cancelPlayEntryRef = useRef<(() => void) | null>(null);
  const playRandomRowRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const headerActionsRef = useRef<HTMLDivElement>(null);
  const playRandomRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const sections = zukan.sections.filter(({ problems }) => problems.length > 0);
  const openSection = findOpenSection(
    sections,
    chosenDifficulty,
    zukan.latestPlayedDifficulty,
  );
  const openDifficulty = openSection.difficulty;
  const openRevealStatus = revealStatuses.get(openDifficulty);
  const openChanges =
    openRevealStatus === "done"
      ? undefined
      : changes.byDifficulty[openDifficulty];
  const openProblems = openSection.problems;
  const filterConditions =
    levelFilter.difficulty === openDifficulty
      ? levelFilter.conditions
      : noZukanFilterConditions;
  const needsLevelFeatures =
    isFilterOpen || hasZukanFeatureConditions(filterConditions);
  const findLevelFeatures = useMemo(
    () => createZukanLevelFeaturesCache(featureAxes, findProblemFeatureValues),
    [featureAxes, findProblemFeatureValues],
  );
  const levelFeatures = useMemo(
    () =>
      needsLevelFeatures
        ? findLevelFeatures(openDifficulty, openProblems)
        : null,
    [openDifficulty, openProblems, needsLevelFeatures, findLevelFeatures],
  );
  const filterConditionCount = countZukanFilterConditions(filterConditions);
  const isFiltering = filterConditionCount > 0;
  const arrangement = useMemo(
    () => arrangeOpenProblems(openProblems, filterConditions, levelFeatures),
    [openProblems, filterConditions, levelFeatures],
  );
  const performanceAxes = useMemo(
    () => listZukanPerformanceAxes(zukan),
    [zukan],
  );
  const countedProblems = hasOpenedFilter ? openProblems : noProblems;
  const filterOptionCounts = useMemo(
    () =>
      countZukanFilterOptions(countedProblems, filterConditions, levelFeatures),
    [countedProblems, filterConditions, levelFeatures],
  );
  const unfilteredOptionCounts = useMemo(
    () =>
      countZukanFilterOptions(
        countedProblems,
        noZukanFilterConditions,
        levelFeatures,
      ),
    [countedProblems, levelFeatures],
  );
  const openAppearance: ZukanChangeAppearance =
    prefersReducedMotion || openRevealStatus === "marked"
      ? "marked"
      : "animated";
  const changeIndices = useMemo(
    () =>
      openChanges === undefined
        ? []
        : listChangeIndices(openProblems, openChanges),
    [openProblems, openChanges],
  );

  function finishLevelReveal(
    difficulty: DifficultyLevel,
    status: LevelRevealStatus,
  ) {
    if (revealStatuses.get(difficulty) === undefined) {
      onLevelChangesShown(difficulty);
    }
    setRevealStatuses((statuses) => new Map(statuses).set(difficulty, status));
  }

  const stampProgress = useZukanChangeReveal({
    difficulty:
      openRevealStatus === undefined && isDocumentVisible
        ? openDifficulty
        : null,
    appearance: openAppearance,
    changeIndices,
    scrollerRef,
    isClickThroughTarget(target) {
      return (
        target instanceof Node &&
        [headerActionsRef, playRandomRef].some(
          ({ current }) => current?.contains(target) === true,
        )
      );
    },
    onShown(difficulty, appearance) {
      finishLevelReveal(
        difficulty,
        appearance === "marked" ? "marked" : "done",
      );
    },
  });
  const changeStages = useMemo(
    () =>
      openChanges === undefined
        ? undefined
        : listChangeStages(
            openProblems,
            changeIndices,
            openAppearance,
            stampProgress,
          ),
    [openProblems, openChanges, changeIndices, openAppearance, stampProgress],
  );
  const pendingChanges = listPendingChanges(openChanges, changeStages);

  // 開いていないレベルの縮図は、押していく演出のたびに作り直さないよう、変わるときだけ求める。
  const restingLevelStatuses = useMemo(
    () =>
      new Map(
        zukan.sections.map(({ difficulty, problems }) => {
          const unseenChanges =
            revealStatuses.get(difficulty) === undefined &&
            !prefersReducedMotion
              ? changes.byDifficulty[difficulty]
              : undefined;
          return [
            difficulty,
            listShownStatuses(problems, unseenChanges),
          ] as const;
        }),
      ),
    [zukan, changes, revealStatuses, prefersReducedMotion],
  );
  // 押していく演出が進んだときだけ求め直し、マスを選ぶなどの描き直しでは縮図を作り直さない。
  // biome-ignore lint/correctness/useExhaustiveDependencies: まだ着いていない変化は、見せる変化と今の段階から決まる。
  const openShownStatuses = useMemo(
    () => listShownStatuses(openProblems, pendingChanges),
    [openProblems, openChanges, changeStages],
  );
  const levelCards: GameLevelCard[] = sections.map((section) => {
    const { difficulty, problems, solvedCount } = section;
    const levelChanges = changes.byDifficulty[difficulty];
    const isOpen = section === openSection;
    const hasUnseenChanges =
      levelChanges !== undefined &&
      revealStatuses.get(difficulty) === undefined &&
      !isOpen;
    // 見せていないレベルの解いた数は、そのレベルを開いて押していくまで前回の数で示す。動きを減らす設定では今の数で示す。
    const unshownNewlySolved = isOpen
      ? countZukanNewlySolved(pendingChanges)
      : hasUnseenChanges && !prefersReducedMotion
        ? countZukanNewlySolved(levelChanges)
        : 0;
    return {
      difficulty,
      summary: levelSummaries[difficulty],
      shownMilestone: findZukanMilestoneProgress(
        solvedCount - unshownNewlySolved,
        problems.length,
      ),
      shownStatuses: isOpen
        ? openShownStatuses
        : (restingLevelStatuses.get(difficulty) ?? noStatuses),
      columnCount: countZukanSheetColumns(sheetWidthPx, problems.length),
      hasUnseenChanges,
    };
  });
  const shownSolvedCount = levelCards.reduce(
    (total, level) => total + level.shownMilestone.solvedCount,
    0,
  );
  const milestoneProblemId = useMemo(
    () =>
      openChanges === undefined
        ? null
        : findMilestoneProblemId(
            openProblems,
            changeIndices,
            openChanges,
            openSection.solvedCount,
          ),
    [openProblems, changeIndices, openChanges, openSection.solvedCount],
  );
  const openStatusCounts = countZukanProblemsByStatus(openProblems, (problem) =>
    getZukanShownProblemStatus(problem, pendingChanges.get(problem.problemId)),
  );
  const selected = findSelectedProblem(
    openDifficulty,
    openProblems,
    selectedKey,
  );
  // 下端に重ねる詳細が押していくマスを隠さないよう、開いているレベルの変化を見せ終えるまで、選んでおいた問題の詳細を出さない。
  const detailProblem =
    openChanges !== undefined && openRevealStatus === undefined
      ? null
      : (selected?.problem ?? null);
  // 変化を見せ終えると選んでおいた問題の詳細が台紙の下端に重なるので、見せている間から、詳細が覆う高さを空けておく。
  // 空けておかないと、詳細が出たときに、色が入ったばかりのマスごと台紙が動く。
  // 詳細を描いてから高さが分かるまでの間も、空けた高さを一度も詰めないよう、見込みの高さを保つ。
  const awaitsDetailHeight = selected !== null && detailOverlayHeight === null;
  const sheetCoveredBottomHeight =
    awaitsDetailHeight && isZukanDetailOverlayingSheet()
      ? PENDING_DETAIL_COVER_HEIGHT_PX
      : (detailOverlayHeight ?? 0);
  const numberDigitCount = getZukanNumberDigitCount(zukan.problemCount);
  // SPEC-029
  const startsWithTutorial =
    renderTutorial !== undefined &&
    !records.some((record) => record.gameId === gameId);

  const handleSelect = useCallback(
    ({ difficulty, problemId }: ZukanProblem) => {
      // 選んだあとに最後に遊んだレベルが変わっても、選んだ問題の台紙を開いたままにする。
      setChosenDifficulty(difficulty);
      setSelectedKey({ difficulty, problemId });
    },
    [],
  );

  const handleDeselect = useCallback(() => {
    setSelectedKey(null);
  }, []);

  function closeDetail() {
    // 詳細の中の操作から閉じたときは、フォーカスを見失わないよう選んでいたマスへ戻す。
    if (
      selected !== null &&
      detailRef.current?.contains(document.activeElement)
    ) {
      findSquareElement(scrollerRef.current, selected.index)?.focus({
        preventScroll: true,
      });
    }
    setSelectedKey(null);
  }

  // ほかの画面から移ってきたときにフォーカスを見失わないよう、選んでおいた問題があればそのマスへ、無ければ見出しへ置く。
  const focusOnOpen = useEffectEvent(() => {
    const target =
      selected === null
        ? titleRef.current
        : findSquareElement(scrollerRef.current, selected.index);
    target?.focus({ preventScroll: true });
  });
  useEffect(() => {
    focusOnOpen();
  }, []);

  const isDetailOpen = detailProblem !== null;
  const closeDetailByEscape = useEffectEvent((event: KeyboardEvent) => {
    // 見方などの開いた層が Escape を受けて閉じたときは、詳細を閉じない。
    if (event.key === "Escape" && !event.defaultPrevented) {
      closeDetail();
    }
  });
  useEffect(() => {
    if (!isDetailOpen) {
      return;
    }
    document.addEventListener("keydown", closeDetailByEscape);
    return () => document.removeEventListener("keydown", closeDetailByEscape);
  }, [isDetailOpen]);

  /** 押している途中でやめたときは、飛ばしたときと同じく見せ終えたものとする。 */
  function finishOpenLevelReveal() {
    if (openChanges !== undefined && openRevealStatus === undefined) {
      finishLevelReveal(openDifficulty, "done");
    }
  }

  function handleLevelChange(value: string) {
    const difficulty = parseDifficultyLevel(value);
    if (difficulty === undefined) {
      return;
    }
    finishOpenLevelReveal();
    setChosenDifficulty(difficulty);
    setSelectedKey(null);
    // 特徴の選択肢はレベルの問題集にある値から作るので、レベルごとに選び直す。
    setLevelFilter(noLevelFilter);
  }

  function handleFilterOpenChange(open: boolean) {
    if (open) {
      finishOpenLevelReveal();
      setHasOpenedFilter(true);
    }
    changeLayerOpen("filter", open);
  }

  function handleOpenLayer(layer: GameHomeLayer) {
    if (layer === "filter") {
      handleFilterOpenChange(true);
      return;
    }
    if (layer === "tutorial") {
      setTutorialPlayTarget(randomTutorialPlayTarget);
    }
    changeLayerOpen(layer, true);
  }

  function openTutorialBeforePlay(target: TutorialPlayTarget) {
    finishOpenLevelReveal();
    setTutorialPlayTarget(target);
    changeLayerOpen("tutorial", true);
  }

  function handleFilterConditionsChange(conditions: ZukanFilterConditions) {
    finishOpenLevelReveal();
    setLevelFilter({ difficulty: openDifficulty, conditions });
    // 並びの途中を見ていても、条件で前に集めた問題から見られるようにする。選んだマスへは寄せ直さない。
    if (scrollerRef.current !== null) {
      scrollerRef.current.scrollTop = 0;
    }
  }

  // プレイへ入る動きの途中でほかの画面へ移ったら、離れた先でプレイを始めないよう、動きをやめる。
  useEffect(() => {
    return () => cancelPlayEntryRef.current?.();
  }, []);

  /**
   * 台紙の問題を始める。そのピースを台紙から抜いてプレイへ入る動きを見せてから始め、動きの間に画面を押すと、すぐに始める。
   * ゲームが選んだ問題は、台紙のどこから抜いたかが分かるよう、台紙を送ってから抜く。
   */
  function enterPlay(problem: ZukanProblem, spinsToPiece: boolean) {
    const square = findSquareElement(
      scrollerRef.current,
      openProblems.indexOf(problem),
    );
    const scroller = scrollerRef.current;
    const screen = screenRef.current;
    if (square === null || scroller === null || screen === null) {
      onPlayProblem(problem);
      return;
    }
    setIsEnteringPlay(true);
    cancelPlayEntryRef.current = playZukanPlayEntry({
      square,
      scroller,
      screen,
      piecePath: getZukanPiecePath(square.dataset.pieceShape ?? ""),
      pictogramSvg,
      spinsToPiece,
      onEnter() {
        onPlayProblem(problem);
      },
    }).cancel;
  }

  function findRandomProblem(): ZukanProblem | null {
    const problemId = pickRandomProblemId(openDifficulty);
    return (
      openProblems.find((problem) => problem.problemId === problemId) ?? null
    );
  }

  function handlePlayRandom() {
    if (startsWithTutorial) {
      openTutorialBeforePlay(randomTutorialPlayTarget);
      return;
    }
    const problem = findRandomProblem();
    if (problem === null) {
      return;
    }
    playPlayStartSound();
    // 条件に当たらなかった問題は後ろへ並べ替えて薄くしているので、抜くピースを今の姿で見せるよう、絞り込みを外す。
    // 抜くピースの位置は外したあとの並びで測るので、外した台紙を先に描き切る。
    flushSync(() => {
      finishOpenLevelReveal();
      setLevelFilter(noLevelFilter);
      setSelectedKey(null);
    });
    enterPlay(problem, true);
  }

  function handlePlayProblem(problem: ZukanProblem) {
    if (startsWithTutorial) {
      openTutorialBeforePlay({ kind: "problem", problem });
      return;
    }
    enterPlay(problem, false);
  }

  const tutorialPlayStart: TutorialPlayStart = {
    difficulty: openDifficulty,
    // チュートリアルを終えて始めるときは、台紙が見えていないので、動かさずに始める。
    onStart() {
      const problem =
        tutorialPlayTarget.kind === "problem"
          ? tutorialPlayTarget.problem
          : findRandomProblem();
      if (problem !== null) {
        playPlayStartSound();
        onPlayProblem(problem);
      }
    },
  };

  function handleDetailOverlayHeightChange(height: number) {
    // 重ねた詳細は「ランダムに遊ぶ」の行も覆うので、台紙を覆う高さからその行の分を除く。
    setDetailOverlayHeight(
      Math.max(height - getOuterHeight(playRandomRowRef.current), 0),
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
      <div
        aria-hidden="true"
        data-browser-surface="child"
        className="pointer-events-none fixed inset-0 -z-10"
      >
        {ground}
      </div>
      {/* 開いたときは、地の上に表示を短く浮かび上がらせる。プレイへ入る動きでは、地を残してこの中の表示だけを引く。動きの間は、動きを飛ばす操作だけを受け、画面の操作は受けない。 */}
      <div
        ref={screenRef}
        inert={isEnteringPlay}
        className="flex min-h-0 flex-1 animate-in flex-col px-4 pt-1 duration-(--duration-slow) ease-enter fade-in motion-reduce:animate-none sm:px-6 sm:pt-3 lg:pb-6"
      >
        <GameHomeHeading
          gameId={gameId}
          gameTitle={gameTitle}
          pictogramSvg={pictogramSvg}
          pictogramShowcaseSvg={pictogramShowcaseSvg}
          shownMilestone={findZukanMilestoneProgress(
            shownSolvedCount,
            zukan.problemCount,
          )}
          titleRef={titleRef}
          actionsRef={headerActionsRef}
        >
          <GameHomeMenu
            buttonRef={menuButtonRef}
            filterConditionCount={filterConditionCount}
            hasTutorial={renderTutorial !== undefined}
            onOpenLayer={handleOpenLayer}
          />
        </GameHomeHeading>
        {renderHowToPlayDialog({
          open: openLayer === "howToPlay",
          onClose() {
            changeLayerOpen("howToPlay", false);
          },
        })}
        {renderTutorial?.({
          open: openLayer === "tutorial",
          onClose() {
            changeLayerOpen("tutorial", false);
          },
          playStart: tutorialPlayStart,
        })}
        <ZukanLegend
          open={openLayer === "legend"}
          onOpenChange={(open) => changeLayerOpen("legend", open)}
          anchorRef={menuButtonRef}
        />
        <ZukanFilter
          conditions={filterConditions}
          matchedCount={arrangement.matchedCount}
          featureAxes={listFilterFeatureAxes(levelFeatures, featureAxes)}
          performanceAxes={performanceAxes}
          optionCounts={filterOptionCounts}
          unfilteredOptionCounts={unfilteredOptionCounts}
          open={isFilterOpen}
          onOpenChange={handleFilterOpenChange}
          anchorRef={menuButtonRef}
          onConditionsChange={handleFilterConditionsChange}
        />
        <GameHomePerformance
          allRecords={records}
          playRecordDisplay={playRecordDisplay}
          difficulty={openDifficulty}
          open={openLayer === "performance"}
          onOpenChange={(open) => changeLayerOpen("performance", open)}
          anchorRef={menuButtonRef}
        />

        <Tabs
          value={openDifficulty}
          onValueChange={handleLevelChange}
          // 矢印キーで選ぶと通り過ぎたレベルの台紙を開いて変化を見せ終えるので、矢印キーではフォーカスだけを動かし、押したときと Enter・Space で選ぶ。
          activationMode="manual"
          className="mt-2 min-h-0 flex-1 sm:mt-3"
        >
          <GameLevelCards levels={levelCards} />
          {/* スマートフォンのカードは一言が収まる幅が無いので、開いているレベルの一言をカードの下に1行で出す。 */}
          <p
            aria-hidden="true"
            className="mt-1 truncate px-1 text-meta text-foreground md:hidden"
          >
            {levelSummaries[openDifficulty]}
          </p>

          {/* スマートフォンでは、状態ごとの数と台紙を1枚の盤に載せ、その下に「ランダムに遊ぶ」を置く。
            PC では、盤に台紙だけを載せ、横の列に「ランダムに遊ぶ」・状態ごとの数・選んだ問題の詳細を上から並べる。 */}
          <div className="relative grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_--spacing(64)] lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:gap-x-8">
            <div
              aria-hidden="true"
              className="col-start-1 row-span-2 row-start-1 rounded-lg bg-background lg:row-span-3 lg:row-start-1"
            />
            {/* 当たった数は条件が無い間も場所を取っておくので、条件を付け外ししても状態ごとの数の折り返し方は変わらない。
              状態ごとの数がレベルによって2行に折り返す狭い画面では、レベルを切り替えても台紙が動かないよう、常に2行分を取っておく。 */}
            <div className="col-start-1 row-start-1 flex items-start justify-between gap-x-3 px-2 pt-2 max-[359px]:min-h-11 sm:px-3 sm:pt-3 lg:col-start-2 lg:row-start-2 lg:mt-4 lg:flex-col lg:gap-y-3 lg:rounded-lg lg:bg-background lg:p-4">
              <ZukanProblemStatusCounts counts={openStatusCounts} />
              <ZukanMatchedCount
                matchedCount={isFiltering ? arrangement.matchedCount : null}
                problemCount={openProblems.length}
              />
            </div>
            <TabsContent
              value={openDifficulty}
              // 台紙のマスへ Tab で入れるので、見えない囲みを Tab の止まり先にしない。
              tabIndex={-1}
              className="col-start-1 row-start-2 flex min-h-0 flex-col px-2 sm:px-3 lg:row-span-3 lg:row-start-1"
            >
              <ZukanProblemSheet
                difficulty={openDifficulty}
                problemsInNumberOrder={openProblems}
                arrangedProblems={arrangement.problems}
                matchedCount={isFiltering ? arrangement.matchedCount : null}
                numberDigitCount={numberDigitCount}
                selectedProblemId={selected?.problem.problemId ?? null}
                changes={openChanges}
                changeStages={changeStages}
                milestoneProblemId={milestoneProblemId}
                scrollerRef={scrollerRef}
                coveredBottomHeight={sheetCoveredBottomHeight}
                onWidthChange={setSheetWidthPx}
                onSelect={handleSelect}
                onDeselect={handleDeselect}
              />
            </TabsContent>
            <div
              ref={playRandomRowRef}
              className="col-start-1 row-start-3 mt-2 grid lg:col-start-2 lg:row-start-1 lg:mt-0"
            >
              <Button ref={playRandomRef} size="lg" onClick={handlePlayRandom}>
                <Shuffle aria-hidden="true" />
                ランダムに遊ぶ
              </Button>
            </div>
            <ZukanProblemDetail
              ref={detailRef}
              coveredSheetScrollerRef={scrollerRef}
              problem={detailProblem}
              numberDigitCount={numberDigitCount}
              describeProblem={describeProblem}
              onPlay={handlePlayProblem}
              onClose={closeDetail}
              onOverlayHeightChange={handleDetailOverlayHeightChange}
            />
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export const _private = { findMilestoneProblemId };

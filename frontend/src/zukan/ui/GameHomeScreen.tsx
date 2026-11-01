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

import { withPlayStartSound } from "@/components/app-decision-sound";
import { HomeBackLink } from "@/components/HomeBackLink";
import type { HowToPlayDialogControl } from "@/components/HowToPlayDialog";
import type {
  ProblemFeature,
  ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
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
import { GameHomeHeading } from "@/zukan/ui/GameHomeScreen/GameHomeHeading";
import {
  type GameLevelCard,
  GameLevelCards,
} from "@/zukan/ui/GameHomeScreen/GameLevelCards";
import {
  useZukanChangeReveal,
  type ZukanStampProgress,
} from "@/zukan/ui/GameHomeScreen/use-zukan-change-reveal";
import { ZukanChangeSummary } from "@/zukan/ui/GameHomeScreen/ZukanChangeSummary";
import { ZukanFilter } from "@/zukan/ui/GameHomeScreen/ZukanFilter";
import { ZukanLegend } from "@/zukan/ui/GameHomeScreen/ZukanLegend";
import { ZukanMatchedCount } from "@/zukan/ui/GameHomeScreen/ZukanMatchedCount";
import { ZukanProblemDetail } from "@/zukan/ui/GameHomeScreen/ZukanProblemDetail";
import { ZukanProblemSheet } from "@/zukan/ui/GameHomeScreen/ZukanProblemSheet";
import { ZukanProblemStatusCounts } from "@/zukan/ui/GameHomeScreen/ZukanProblemStatusCounts";
import {
  countZukanNewlySolved,
  getZukanShownProblemStatus,
  getZukanStampSlot,
  type ZukanChangeAppearance,
  type ZukanChangeStage,
} from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";
import type { ZukanFilterFeatureAxis } from "@/zukan/ui/GameHomeScreen/zukan-filter-appearance";
import { getZukanNumberDigitCount } from "@/zukan/ui/GameHomeScreen/zukan-problem-appearance";
import {
  countZukanProblemsByStatus,
  type GameZukan,
  type ZukanDifficultySection,
  type ZukanProblem,
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

/** 絞り込みで問題を分ける、問題の特徴の1つの軸と、その名前と値の書き方。 */
export type ZukanFeatureAxis = ZukanFeatureAxisSource & {
  display: ProblemFeatureAxisDisplay;
};

export type GameHomeScreenProps = {
  /** 見出しに使うゲームの表示名。 */
  gameTitle: string;
  /** 見出しに添えるゲームのピクトグラム。 */
  pictogramSvg: string;
  zukan: GameZukan;
  /** 前回図鑑を見たときから、この図鑑までの変化。 */
  changes: ZukanChanges;
  /**
   * レベルの変化を見せ終えたとき。最後まで押したとき・飛ばしたとき・押している途中で別のレベルへ切り替えたときと、
   * 動きを減らす設定で印を載せた台紙を見せたとき。画面を離れて演出をやめたときは呼ばない。
   */
  onLevelChangesShown: (difficulty: DifficultyLevel) => void;
  /** 開いたときに選んでおく問題。その問題のレベルを開いて詳細を出す。図鑑に無い問題なら選ばない。 */
  initialSelectedProblemId: ProblemId | null;
  /** 開いているレベルの問題から、ゲームが選ぶ問題で新しいプレイを始める。 */
  onPlayRandom: (difficulty: DifficultyLevel) => void;
  /** 図鑑の問題を、新しいプレイとして始める。 */
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
  /** レベルのカードに示す、その難易度の盤面の見本を描く。 */
  renderLevelPreview: (difficulty: DifficultyLevel) => ReactNode;
  /** ゲーム固有の遊び方ダイアログを描く。開閉の状態は見出しが持ち、引数で渡す。 */
  renderHowToPlayDialog: (control: HowToPlayDialogControl) => ReactNode;
};

type SelectedProblemKey = { difficulty: DifficultyLevel; problemId: ProblemId };

type SelectedProblem = { problem: ZukanProblem; index: number };

/** 絞り込みの条件と、条件をかけたレベル。 */
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

/** 開いているレベルで選べる特徴の軸に、軸の名前と値の書き方を添える。 */
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
 * 開いている台紙。選ぶまでは、そのゲームで最後にクリアまたは離脱したレベルを開き、そのゲームを遊んだことが無ければ最も低いレベルを開く。
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

/** 図鑑の問題を問題 ID で引き、選ぶ問題として持つ形にする。図鑑に無ければ `null`。 */
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

/** 開いている台紙の変化したマスごとの、今見せている段階。 */
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
 * 1ゲームのホーム。遊ぶレベルを選んでプレイを始める操作と、そのゲームの図鑑を1画面にまとめる。
 * 上から、ホームへ戻る導線、ゲーム名の見出し、レベルのカード、開いているレベルで遊ぶ「ランダムに遊ぶ」、開いているレベルの台紙を置く。
 * 開いたときは、選んでおく問題があればそのレベル、無ければそのゲームで最後にクリアまたは離脱したレベル、そのゲームを遊んだことが無ければ最も低いレベルを開く。
 * 最も低いレベルのカードもほかのカードと同じ姿で示し、推奨として強調しない。
 * 開いたときは、ほかの画面から移ってきてもフォーカスを見失わないよう、選んでおいた問題のマス、無ければゲーム名の見出しへフォーカスを置く。
 *
 * 図鑑は、難易度ごとの全問をマス目の台紙にし、レベルのカードで1枚ずつ切り替えて見せる。カードには各レベルの解いた数を添え、全レベルの進み具合を切り替えずに分かるようにする。
 * 画面の高さに収め、台紙だけをスクロールさせる。台紙の上には、そのレベルの問題の数を評価段階ごとと挑戦中・未挑戦に分けて示す。
 * マスを選んでいる間だけ、その問題の詳細と始める操作を出す。スマートフォンでは台紙の高さを変えずに下端へ重ね、PC では台紙の幅を変えないよう横の列を空けておく。
 * 詳細は、閉じるボタン・選んでいるマスをもう一度押す・Escape で閉じる。解いた問題の数は全問の数と並べた静かな計数で示し、カードに示す数の合計と常に一致させる。
 * 前回図鑑を見たときからの変化は、全レベルを合わせた1行の数と、変化をまだ見せていないレベルのカードの点で示し、各レベルの台紙を初めて開いたときに一度だけ見せる。
 * 見せるときは、台紙と数を前回の姿で描き始め、変化したマスを1つずつ押していき、押してマスに着くたびに、そのレベルのカードの数・状態ごとの数・解いた数を今の数へ数え上げる。
 * ページが見えるまでは見せ始めない。画面を押すかキーを押すと最後の姿まで飛ばす。
 * 絞り込みは開いているレベルの台紙にかけ、当たった問題を前に詰め、当たらなかった問題を薄くして後ろに並べる。条件は保存せず、開いたときは条件なしで始め、レベルを切り替えると外す。
 * 条件は、かけたレベルを添えて持ち、選ぶ前に最初に開くレベルが変わったときも、ほかのレベルには持ち越さない。条件を変えると台紙を先頭までスクロールし、前に集めた問題を見せる。
 * 変化は絞り込みの無い台紙で見せる。見せている途中で絞り込みを開くか条件を選ぶと、見せ終えたものとする。
 * 遊び方・見方・絞り込みのボタン、「ランダムに遊ぶ」、詳細の中の操作を押したタップは、最後の姿まで飛ばしたうえでそのまま操作する。
 * 状態ごとの数は、絞り込んでいても台紙の全問で数え、当たった問題の数は同じ行の右に添える。
 */
export function GameHomeScreen({
  gameTitle,
  pictogramSvg,
  zukan,
  changes,
  initialSelectedProblemId,
  onPlayRandom,
  onPlayProblem,
  describeProblem,
  onLevelChangesShown,
  featureAxes,
  findProblemFeatureValues,
  renderLevelPreview,
  renderHowToPlayDialog,
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
  const [isFilterOpen, setIsFilterOpen] = useState(false);
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
  const [detailOverlayHeight, setDetailOverlayHeight] = useState(0);
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
  const isFiltering = countZukanFilterConditions(filterConditions) > 0;
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
  const filterOptionCountLimits = useMemo(
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
        [headerActionsRef, playRandomRef, detailRef].some(
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
      problemCount: problems.length,
      solvedCount: solvedCount - unshownNewlySolved,
      hasUnseenChanges,
    };
  });
  const shownSolvedCount = levelCards.reduce(
    (total, { solvedCount }) => total + solvedCount,
    0,
  );
  const openStatusCounts = countZukanProblemsByStatus(openProblems, (problem) =>
    getZukanShownProblemStatus(problem, pendingChanges.get(problem.problemId)),
  );
  const selected = findSelectedProblem(
    openDifficulty,
    openProblems,
    selectedKey,
  );
  const numberDigitCount = getZukanNumberDigitCount(zukan.problemCount);
  const hasChanges = changes.newlySolvedCount + changes.raisedCount > 0;

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

  const isDetailOpen = selected !== null;
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
    setIsFilterOpen(open);
  }

  function handleFilterConditionsChange(conditions: ZukanFilterConditions) {
    finishOpenLevelReveal();
    setLevelFilter({ difficulty: openDifficulty, conditions });
    // 並びの途中を見ていても、条件で前に集めた問題から見られるようにする。選んだマスへは寄せ直さない。
    if (scrollerRef.current !== null) {
      scrollerRef.current.scrollTop = 0;
    }
  }

  const handlePlayRandom = withPlayStartSound(() =>
    onPlayRandom(openDifficulty),
  );

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 pt-4 sm:px-6 sm:pt-6 lg:pb-8">
      <div>
        <HomeBackLink />
      </div>
      <GameHomeHeading
        gameTitle={gameTitle}
        pictogramSvg={pictogramSvg}
        solvedCount={shownSolvedCount}
        problemCount={zukan.problemCount}
        titleRef={titleRef}
        actionsRef={headerActionsRef}
        renderHowToPlayDialog={renderHowToPlayDialog}
      >
        <ZukanLegend />
        <ZukanFilter
          conditions={filterConditions}
          matchedCount={arrangement.matchedCount}
          featureAxes={listFilterFeatureAxes(levelFeatures, featureAxes)}
          performanceAxes={performanceAxes}
          optionCounts={filterOptionCounts}
          optionCountLimits={filterOptionCountLimits}
          open={isFilterOpen}
          onOpenChange={handleFilterOpenChange}
          onConditionsChange={handleFilterConditionsChange}
        />
      </GameHomeHeading>

      <Tabs
        value={openDifficulty}
        onValueChange={handleLevelChange}
        activationMode="manual"
        className="mt-3 min-h-0 flex-1"
      >
        <GameLevelCards
          levels={levelCards}
          openDifficulty={openDifficulty}
          renderLevelPreview={renderLevelPreview}
        />
        <div className="grid sm:grid-cols-[--spacing(64)]">
          <Button ref={playRandomRef} size="lg" onClick={handlePlayRandom}>
            <Shuffle aria-hidden="true" />
            ランダムに遊ぶ
          </Button>
        </div>
        {hasChanges && (
          <ZukanChangeSummary
            newlySolvedCount={changes.newlySolvedCount}
            raisedCount={changes.raisedCount}
          />
        )}

        <div className="relative flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_--spacing(64)] lg:grid-rows-[minmax(0,1fr)] lg:gap-8">
          <div className="flex min-h-0 flex-1 flex-col">
            <TabsContent
              value={openDifficulty}
              // 台紙のマスへ Tab で入れるので、見えない囲みを Tab の止まり先にしない。
              tabIndex={-1}
              className="flex min-h-0 flex-col"
            >
              {/* 当たった数は条件が無い間も場所を取っておくので、条件を付け外ししても状態ごとの数の折り返し方は変わらない。
                  状態ごとの数がレベルによって2行に折り返す狭い画面では、レベルを切り替えても台紙が動かないよう、常に2行分を取っておく。 */}
              <div className="flex items-start justify-between gap-x-3 max-[359px]:min-h-9">
                <ZukanProblemStatusCounts counts={openStatusCounts} />
                <ZukanMatchedCount
                  matchedCount={isFiltering ? arrangement.matchedCount : null}
                  problemCount={openProblems.length}
                />
              </div>
              <ZukanProblemSheet
                difficulty={openDifficulty}
                problems={openProblems}
                arrangedProblems={arrangement.problems}
                matchedCount={isFiltering ? arrangement.matchedCount : null}
                numberDigitCount={numberDigitCount}
                selectedProblemId={selected?.problem.problemId ?? null}
                changes={openChanges}
                changeStages={changeStages}
                scrollerRef={scrollerRef}
                coveredBottomHeight={detailOverlayHeight}
                onSelect={handleSelect}
                onDeselect={handleDeselect}
              />
            </TabsContent>
          </div>
          <ZukanProblemDetail
            ref={detailRef}
            coverLimitRef={scrollerRef}
            problem={selected?.problem ?? null}
            numberDigitCount={numberDigitCount}
            describeProblem={describeProblem}
            onPlay={onPlayProblem}
            onClose={closeDetail}
            onOverlayHeightChange={setDetailOverlayHeight}
          />
        </div>
      </Tabs>
    </div>
  );
}

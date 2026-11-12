import {
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { withPlayStartSound } from "@/components/app-decision-sound";
import type { HowToPlayDialogControl } from "@/components/HowToPlayDialog";
import { settlePlayBoard } from "@/components/play-board-return";
import type {
  ProblemFeature,
  ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { Tabs } from "@/components/ui/tabs";
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
import { GameHomeFrame } from "@/zukan/ui/GameHomeScreen/GameHomeFrame";
import { GameHomeHeading } from "@/zukan/ui/GameHomeScreen/GameHomeHeading";
import { GameHomeMenu } from "@/zukan/ui/GameHomeScreen/GameHomeMenu";
import { GameHomePerformance } from "@/zukan/ui/GameHomeScreen/GameHomePerformance";
import { GameHomeStage } from "@/zukan/ui/GameHomeScreen/GameHomeStage";
import {
  type GameLevel,
  GameLevelRail,
} from "@/zukan/ui/GameHomeScreen/GameLevelRail";
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
import {
  hasZukanPlayEntryBoard,
  playZukanPlayEntry,
} from "@/zukan/ui/GameHomeScreen/zukan-play-entry";
import { getZukanNumberDigitCount } from "@/zukan/ui/zukan-number-format";
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
  gameId: string;
  /** 見出しに使うゲームの表示名。 */
  gameTitle: string;
  /** 見出しに添えるゲームのピクトグラム。 */
  pictogramSvg: string;
  /** ゲーム固有の地。プレイ画面の地の元になるもの。 */
  ground: ReactNode;
  zukan: GameZukan;
  /** 前回図鑑を見たときから、この図鑑までの変化。 */
  changes: ZukanChanges;
  /**
   * レベルの変化を見せ終えたとき。最後まで押したとき・飛ばしたとき・押している途中で別のレベルへ切り替えたときと、
   * 動きを減らす設定で印を載せた台紙を見せたとき。画面を離れて演出をやめたときは呼ばない。
   */
  onLevelChangesShown: (difficulty: DifficultyLevel) => void;
  /** 開いたときに選んでおく問題。その問題のレベルを開き、これから遊ぶ1問にする。図鑑に無い問題なら、ゲームが選ぶ。 */
  initialSelectedProblemId: ProblemId | null;
  /** そのレベルの問題から、ゲームが選ぶ問題。`avoidedProblemId` の問題は選ばない。選べる問題が無ければ `null`。 */
  selectRandomProblemId: (
    difficulty: DifficultyLevel,
    avoidedProblemId?: ProblemId,
  ) => ProblemId | null;
  /** 「別の問題」で替えられる問題が無かった。 */
  onRandomProblemUnavailable: (difficulty: DifficultyLevel) => void;
  /** 図鑑の問題を、新しいプレイとして始める。その問題の盤面が画面に広がってから呼ぶ。 */
  onPlayProblem: (problem: ZukanProblem) => void;
  /** 問題の、始めたときの盤面を見れば分かる特徴。選んだ1問についてだけ求める。求められなければ `null`。 */
  describeProblem: (problem: ZukanProblem) => readonly ProblemFeature[] | null;
  /** 問題の、始めたときの盤面を描く。これから遊ぶ1問についてだけ描く。描けなければ `null`。 */
  renderProblemPreview: (problem: ZukanProblem) => ReactNode | null;
  /** 絞り込みに使う、問題の特徴の軸。示す順。 */
  featureAxes: readonly ZukanFeatureAxis[];
  /**
   * 問題の、絞り込みに使う特徴の値を軸の ID ごとに返す。求められなければ `null`。
   * 絞り込みを開いたときか特徴の条件をかけたときに、開いているレベルの全問について、レベルごとに一度だけ求める。
   */
  findProblemFeatureValues: (
    problem: ZukanProblem,
  ) => ReadonlyMap<string, ProblemFeatureValue> | null;
  /** ゲーム固有の遊び方ダイアログを描く。開閉の状態は画面が持ち、引数で渡す。 */
  renderHowToPlayDialog: (control: HowToPlayDialogControl) => ReactNode;
  /**
   * ゲーム固有のチュートリアルを描く。開閉の状態は画面が持ち、終えて開いているレベルを始める操作と一緒に引数で渡す。
   * 省略すると、見出しのメニューにチュートリアルを出さない。
   */
  renderTutorial?: (control: GameHomeTutorialControl) => ReactNode;
  /** 全記録。開いているレベルの成績（自己ベスト・推移）を、成績を開いたときにこの中から求める。 */
  records: readonly PlayRecord[];
  /** そのゲームの記録表示。成績の指標の名前と値の書き方に使う。 */
  playRecordDisplay: PlayRecordDisplayDefinition;
};

/** ゲームのホームから開いたチュートリアルの開閉の状態と、終えてプレイへ進む操作。 */
export type GameHomeTutorialControl = HowToPlayDialogControl & {
  /** チュートリアルを終えて、開いているレベルのプレイを始める。 */
  playStart: TutorialPlayStart;
};

type SelectedProblemKey = { difficulty: DifficultyLevel; problemId: ProblemId };

/** レベルごとの、これから遊ぶ1問。出題できる問題が無かったレベルは `null`。まだ決めていないレベルは持たない。 */
type LevelPicks = Partial<Record<DifficultyLevel, ProblemId | null>>;

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

/** 離脱の保存で図鑑が導き直されても選んだ問題を保つよう、選択は問題 ID で持ち、今の台紙の問題から引き直す。 */
function findPickedProblem(
  problems: readonly ZukanProblem[],
  problemId: ProblemId | null | undefined,
): ZukanProblem | null {
  return problems.find((problem) => problem.problemId === problemId) ?? null;
}

const noProblems: readonly ZukanProblem[] = [];

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
 * 1ゲームのホーム。これから遊ぶ1問の盤面を主役にし、遊ぶレベルを選ぶ帯と、そのレベルの図鑑を添える。
 * 画面全体にゲーム固有の地を敷き、その上に、ホームへ戻る導線を頭に置いたゲーム名の見出しと、これから遊ぶ1問の盤面・番号・始める操作を置く。
 * その下（広い画面では横）に、レベルの帯と、開いているレベルの全問をピースにした台紙と、状態ごとの数をまとめた図鑑の面を置く。
 * 開いたときは、選んでおく問題があればそのレベル、無ければそのゲームで最後にクリアまたは離脱したレベル、そのゲームを遊んだことが無ければ最も低いレベルを開く。
 * どのレベルも同じ姿で示し、推奨として強調しない。
 *
 * これから遊ぶ1問は、いつも1つ決まっている。選んでおく問題が無いレベルでは、ランダム出題の条件でゲームが選ぶ。レベルごとに持ち、レベルを行き来しても替えない。
 * 「別の問題」は、同じ条件で今の問題を除いて選び直す。台紙のピースを押すかなぞると、その問題に替える。条件に合う問題が無いレベルでは、盤面の代わりにその旨を示す。
 * 「遊ぶ」と盤面そのものは、見せている盤面をプレイ画面の盤面の所へ広げ、そこでプレイ画面を開く。チュートリアルを終えて始めるときも同じ。
 * プレイ画面から戻ってきたときは、選んでおいた問題の盤面を、プレイ画面で盤面があった所から縮めて収める。縮む盤面と重なる見出し・操作は盤面が通り過ぎてから現す。
 *
 * 台紙は、画面に収まる大きさのピースで全問を送らずに見せる。そのレベルの問題の数を評価段階ごとと挑戦中・未挑戦に分けた状態ごとの数を、台紙の下に示す。絞り込んでいても台紙の全問で数え、当たった問題の数を添える。
 * 解いた問題の数は全問の数と並べた静かな計数で示し、帯に示す数の合計と常に一致させる。
 *
 * 前回図鑑を見たときからの変化は、変化をまだ見せていないレベルの帯の点で示し、各レベルの台紙を初めて開いたときに一度だけ見せる。
 * 見せるときは、台紙と数を前回の姿で描き始め、変化したマスを1つずつ押していき、押してマスに着くたびに、そのレベルの帯の数・状態ごとの数・解いた数を今の数へ数え上げる。
 * ページが見えるまでは見せ始めない。画面を押すかキーを押すと最後の姿まで飛ばす。動きを減らす設定では、押さずに変化したマスへ印を載せる。
 *
 * 絞り込みは開いているレベルの台紙にかけ、当たった問題を前に詰め、当たらなかった問題を薄くして後ろに並べる。条件は保存せず、開いたときは条件なしで始め、レベルを切り替えると外す。
 * 条件は、かけたレベルを添えて持ち、選ぶ前に最初に開くレベルが変わったときも、ほかのレベルには持ち越さない。
 * 変化は絞り込みの無い台紙で見せる。見せている途中で絞り込みを開くか条件を選ぶと、見せ終えたものとする。
 * 遊び方・チュートリアル・見方・絞り込み・成績は、見出しの1つのメニューから開く。メニューのボタンと「別の問題」を押したタップは、最後の姿まで飛ばしたうえでそのまま操作する。
 * 成績は、開いているレベルの自己ベスト・推移・記録の JSON コピーを、見出しのメニューから開いたときだけ示す。
 */
export function GameHomeScreen({
  gameId,
  gameTitle,
  pictogramSvg,
  ground,
  zukan,
  changes,
  initialSelectedProblemId,
  selectRandomProblemId,
  onRandomProblemUnavailable,
  onPlayProblem,
  describeProblem,
  renderProblemPreview,
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
  const [picks, setPicks] = useState<LevelPicks>(() =>
    initialSelectedKey === null
      ? {}
      : { [initialSelectedKey.difficulty]: initialSelectedKey.problemId },
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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const isEnteringPlayRef = useRef(false);
  const cancelPlayEntryRef = useRef<(() => void) | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const headerActionsRef = useRef<HTMLDivElement>(null);
  const shuffleRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const sections = zukan.sections.filter(({ problems }) => problems.length > 0);
  const openSection = findOpenSection(
    sections,
    chosenDifficulty,
    zukan.latestPlayedDifficulty,
  );
  const openDifficulty = openSection.difficulty;
  // 開いているレベルの1問をまだ決めていなければ、ゲームが選ぶ。選ぶ前に最初に開くレベルが変わったときも、そのレベルの1問を決める。
  if (picks[openDifficulty] === undefined) {
    setPicks({
      ...picks,
      [openDifficulty]: selectRandomProblemId(openDifficulty),
    });
  }
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
        [headerActionsRef, shuffleRef].some(
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
  const pendingChanges = useMemo(
    () => listPendingChanges(openChanges, changeStages),
    [openChanges, changeStages],
  );

  const levels: GameLevel[] = sections.map((section) => {
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
  const shownSolvedCount = levels.reduce(
    (total, { solvedCount }) => total + solvedCount,
    0,
  );
  const openStatusCounts = useMemo(
    () =>
      countZukanProblemsByStatus(openProblems, (problem) =>
        getZukanShownProblemStatus(
          problem,
          pendingChanges.get(problem.problemId),
        ),
      ),
    [openProblems, pendingChanges],
  );
  const shownMatchedCount = isFiltering ? arrangement.matchedCount : null;
  const openProblemCount = openProblems.length;
  const selected = findPickedProblem(openProblems, picks[openDifficulty]);
  const isRevealing =
    openChanges !== undefined &&
    openRevealStatus === undefined &&
    openAppearance === "animated" &&
    changeIndices.length > 0;
  const numberDigitCount = getZukanNumberDigitCount(zukan.problemCount);

  const handleSelect = useCallback(
    ({ difficulty, problemId }: ZukanProblem) => {
      // 選んだあとに最後に遊んだレベルが変わっても、選んだ問題の台紙を開いたままにする。
      setChosenDifficulty(difficulty);
      setPicks((current) => ({ ...current, [difficulty]: problemId }));
    },
    [],
  );

  // ほかの画面から移ってきたときにフォーカスを見失わないよう、見出しへ置く。
  const focusOnOpen = useEffectEvent(() => {
    titleRef.current?.focus({ preventScroll: true });
  });
  useEffect(() => {
    focusOnOpen();
  }, []);

  // プレイ画面から戻ってきたら、解いていた盤面を、これから遊ぶ1問の盤面の所へ収める。
  // ジグソーは盤面の下に見せたままにし、縮む盤面と重なると読みにくい文字と操作だけを、盤面が通り過ぎるまで退かせる。
  useLayoutEffect(() => {
    return previewRef.current === null
      ? undefined
      : settlePlayBoard(
          previewRef.current,
          sceneRef.current?.querySelectorAll("[data-settle-chrome]"),
        );
  }, []);

  // 盤面が広がる間にこの画面を離れたら、離れた先からプレイ画面へ連れ戻さない。
  useEffect(() => {
    return () => cancelPlayEntryRef.current?.();
  }, []);

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
    changeLayerOpen(layer, true);
  }

  function handleFilterConditionsChange(conditions: ZukanFilterConditions) {
    finishOpenLevelReveal();
    setLevelFilter({ difficulty: openDifficulty, conditions });
  }

  /** 盤面を画面に広げ、その下でプレイを始める。 */
  function enterPlay(problem: ZukanProblem) {
    const board = previewRef.current;
    // 盤面をまだ描けていない（問題集を読み込んでいる途中など）ときは、広げるものが無いので、そのまま始める。
    if (
      board === null ||
      sceneRef.current === null ||
      !hasZukanPlayEntryBoard(board)
    ) {
      onPlayProblem(problem);
      return;
    }
    isEnteringPlayRef.current = true;
    cancelPlayEntryRef.current = playZukanPlayEntry({
      board,
      scene: sceneRef.current,
      onArrive() {
        onPlayProblem(problem);
      },
      onFinished() {
        isEnteringPlayRef.current = false;
      },
    });
  }

  const startSelectedPlay = withPlayStartSound(() => {
    if (selected !== null) {
      enterPlay(selected);
    }
  });

  // 盤面が広がる間に押し直しても、プレイを二重に始めず、始める音も鳴らさない。
  function handlePlaySelected() {
    if (isEnteringPlayRef.current) {
      return;
    }
    if (selected === null) {
      onRandomProblemUnavailable(openDifficulty);
      return;
    }
    startSelectedPlay();
  }

  function handleShuffle() {
    if (isEnteringPlayRef.current) {
      return;
    }
    const problemId = selectRandomProblemId(
      openDifficulty,
      selected?.problemId,
    );
    if (problemId === null) {
      onRandomProblemUnavailable(openDifficulty);
      return;
    }
    finishOpenLevelReveal();
    setPicks((current) => ({ ...current, [openDifficulty]: problemId }));
  }

  // 特定のレベルを勧めないよう、チュートリアルを終えたら、開いているレベルのこれから遊ぶ1問を始める。
  const tutorialPlayStart: TutorialPlayStart = {
    difficulty: openDifficulty,
    onStart: handlePlaySelected,
  };

  return (
    <GameHomeFrame ground={ground}>
      <div
        ref={sceneRef}
        className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col pt-2 sm:pt-4"
      >
        <div className="px-4 sm:px-6">
          <GameHomeHeading
            gameId={gameId}
            gameTitle={gameTitle}
            pictogramSvg={pictogramSvg}
            solvedCount={shownSolvedCount}
            problemCount={zukan.problemCount}
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
        </div>
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
          optionCountLimits={filterOptionCountLimits}
          open={isFilterOpen}
          onOpenChange={handleFilterOpenChange}
          anchorRef={menuButtonRef}
          onConditionsChange={handleFilterConditionsChange}
        />
        <GameHomePerformance
          records={records}
          playRecordDisplay={playRecordDisplay}
          difficulty={openDifficulty}
          open={openLayer === "performance"}
          onOpenChange={(open) => changeLayerOpen("performance", open)}
          anchorRef={menuButtonRef}
        />

        <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-10 lg:px-6 lg:pt-4 lg:pb-8">
          <div className="flex min-h-0 flex-1 flex-col px-4 pt-2 pb-3 sm:px-6 lg:p-0">
            <GameHomeStage
              problem={selected}
              numberDigitCount={numberDigitCount}
              describeProblem={describeProblem}
              renderProblemPreview={renderProblemPreview}
              previewRef={previewRef}
              shuffleRef={shuffleRef}
              onPlay={handlePlaySelected}
              onShuffle={handleShuffle}
            />
          </div>
          <Tabs
            value={openDifficulty}
            onValueChange={handleLevelChange}
            activationMode="manual"
            data-settle-chrome=""
            className="h-[42%] min-h-0 shrink-0 gap-0 bg-card px-4 pb-2 sm:px-6 lg:h-auto lg:rounded-lg lg:px-6 lg:pb-4"
          >
            <GameLevelRail levels={levels} />
            <div className="flex min-h-0 flex-1 flex-col pt-3">
              <ZukanProblemSheet
                difficulty={openDifficulty}
                problems={openProblems}
                arrangedProblems={arrangement.problems}
                matchedCount={shownMatchedCount}
                numberDigitCount={numberDigitCount}
                selectedProblemId={selected?.problemId ?? null}
                changes={openChanges}
                changeStages={changeStages}
                scrollerRef={scrollerRef}
                selectionDisabled={isRevealing}
                onSelect={handleSelect}
              />
            </div>
            <div className="flex items-start justify-between gap-x-3 pt-2">
              <ZukanProblemStatusCounts counts={openStatusCounts} />
              <ZukanMatchedCount
                matchedCount={shownMatchedCount}
                problemCount={openProblemCount}
              />
            </div>
          </Tabs>
        </div>
      </div>
    </GameHomeFrame>
  );
}

import { Shuffle } from "lucide-react";
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
import { flushSync } from "react-dom";
import { withPlayStartSound } from "@/components/app-decision-sound";
import type { HowToPlayDialogControl } from "@/components/HowToPlayDialog";
import { settlePlayBoard } from "@/components/play-board-return";
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
import { GameHomeFrame } from "@/zukan/ui/GameHomeScreen/GameHomeFrame";
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
import { ZukanProblemSheet } from "@/zukan/ui/GameHomeScreen/ZukanProblemSheet";
import { ZukanProblemStatusCounts } from "@/zukan/ui/GameHomeScreen/ZukanProblemStatusCounts";
import { ZukanSelectedProblem } from "@/zukan/ui/GameHomeScreen/ZukanSelectedProblem";
import {
  countZukanNewlySolved,
  getZukanShownProblemStatus,
  type ZukanChangeAppearance,
  type ZukanChangeStage,
} from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";
import type { ZukanFilterFeatureAxis } from "@/zukan/ui/GameHomeScreen/zukan-filter-appearance";
import {
  hasZukanPlayEntryBoard,
  playZukanPlayEntry,
  ZUKAN_MAX_CANDIDATE_PIECE_COUNT,
} from "@/zukan/ui/GameHomeScreen/zukan-play-entry";
import {
  concealSelectedProblemBoard,
  detachSelectedProblemBoard,
  revealSelectedProblem,
} from "@/zukan/ui/GameHomeScreen/zukan-selected-problem-motion";
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
  /** 開いたときに選んでおく問題。その問題のレベルを開き、選んだ姿にして盤面を見せる。図鑑に無い問題なら選ばない。 */
  initialSelectedProblemId: ProblemId | null;
  /** そのレベルの問題から、ゲームが選ぶ問題。「ランダムに遊ぶ」で始める問題にする。選べる問題が無ければ `null`。 */
  selectRandomProblemId: (difficulty: DifficultyLevel) => ProblemId | null;
  /** 「ランダムに遊ぶ」で始められる問題が無かった。 */
  onRandomProblemUnavailable: (difficulty: DifficultyLevel) => void;
  /** 図鑑の問題を、新しいプレイとして始める。その問題の盤面が画面に広がってから呼ぶ。 */
  onPlayProblem: (problem: ZukanProblem) => void;
  /** 問題の、始めたときの盤面を見れば分かる特徴。選んだ1問についてだけ求める。求められなければ `null`。 */
  describeProblem: (problem: ZukanProblem) => readonly ProblemFeature[] | null;
  /** 問題の、始めたときの盤面を描く。選んだ1問と、ランダムに遊ぶ1問についてだけ描く。描けなければ `null`。 */
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

/** 選んでいるピースのマス。 */
function findSelectedSquareElement(
  scroller: HTMLElement | null,
): HTMLElement | null {
  return (
    scroller?.querySelector<HTMLElement>('[data-index][aria-current="true"]') ??
    null
  );
}

/**
 * 「ランダムに遊ぶ」で、ゲームが選んでいる途中として順に光らせる、台紙に見えているまだ解いていないピース。決まったピースは含めない。
 * 見えている中からでたらめに選び、決まったピースへ近づいていくよう、遠い順に並べる。
 */
function listRandomCandidatePieces(
  scroller: HTMLElement | null,
  problems: readonly ZukanProblem[],
  chosen: HTMLElement,
): HTMLElement[] {
  if (scroller === null) {
    return [];
  }
  const view = scroller.getBoundingClientRect();
  const target = chosen.getBoundingClientRect();
  const visible = [
    ...scroller.querySelectorAll<HTMLElement>("[data-index]"),
  ].flatMap((square) => {
    const problem = problems[Number(square.dataset.index)];
    const box = square.getBoundingClientRect();
    const isShown =
      box.width > 0 &&
      box.top >= view.top &&
      box.bottom <= view.bottom &&
      box.left >= view.left &&
      box.right <= view.right;
    return square !== chosen &&
      problem !== undefined &&
      problem.kind !== "solved" &&
      isShown
      ? [
          {
            square,
            distance: Math.hypot(box.x - target.x, box.y - target.y),
            shuffleKey: Math.random(),
          },
        ]
      : [];
  });
  return visible
    .sort((a, b) => a.shuffleKey - b.shuffleKey)
    .slice(0, ZUKAN_MAX_CANDIDATE_PIECE_COUNT)
    .sort((a, b) => b.distance - a.distance)
    .map(({ square }) => square);
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
  { startedCount, landedCount }: ZukanStampProgress,
): ZukanChangeStage {
  if (order < landedCount) {
    return "landed";
  }
  return order < startedCount ? "stamping" : "waiting";
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
 * 1ゲームのホーム。解いた問題がピースとして埋まっていくそのゲームのジグソーを主役にし、遊ぶレベルを選んで始める操作を添える。
 * 画面全体にゲーム固有の地を敷き、その上に、ホームへ戻る導線を頭に置いたゲーム名の見出し、レベルのカード、開いているレベルのジグソー、始める操作を置く。
 * 開いたときは、選んでおく問題があればそのレベル、無ければそのゲームで最後にクリアまたは離脱したレベル、そのゲームを遊んだことが無ければ最も低いレベルを開く。
 * 最も低いレベルのカードもほかのカードと同じ姿で示し、推奨として強調しない。
 * 開いたときは、ほかの画面から移ってきてもフォーカスを見失わないよう、選んでおいた問題のマス、無ければゲーム名の見出しへフォーカスを置く。
 *
 * ジグソーは、難易度ごとの全問をピースにした台紙で、レベルのカードで1枚ずつ切り替えて見せる。カードには各レベルの解いた数を添え、全レベルの進み具合を切り替えずに分かるようにする。
 * 画面の高さに収め、台紙だけをスクロールさせる。
 * そのレベルの問題の数を評価段階ごとと挑戦中・未挑戦に分けた状態ごとの数は、狭い画面では台紙の頭に、広い画面ではジグソーの横の列に一覧で示す。絞り込んでいても台紙の全問で数え、当たった問題の数は台紙の頭の右に添える。
 * 解いた問題の数は全問の数と並べた静かな計数で示し、カードに示す数の合計と常に一致させる。
 * 始める「ランダムに遊ぶ」は、狭い画面ではジグソーの下に、広い画面では状態ごとの数の一覧の下に置く。
 *
 * 問題の盤面は、ピースを選んでいる間だけ見せる。選んだ問題の欄に盤面をプレイ画面と同じ姿で出し、その問題の「遊ぶ」を添える。
 * 欄は、狭い画面ではジグソーの下端に重ね、重なった高さだけ台紙が選んだピースを上へ寄せられるようにする。広い画面では「ランダムに遊ぶ」と状態ごとの数の一覧に替える。
 * 選ぶと盤面はそのピースから欄へ広がって現れ、閉じるボタンか、選んでいるピースをもう一度押して選択を解くと、ピースへ戻る。
 * 「遊ぶ」は、見せている盤面をプレイ画面の盤面の所へ広げ、そこでプレイ画面を開く。
 * 「ランダムに遊ぶ」は、開いているレベルからゲームが選んだ問題のピースを見える所へ送り、見えているまだ解いていないピースを候補として順に光らせてから、選んだピースを持ち上げ、その位置から盤面を広げてプレイ画面を開く。
 * チュートリアルを終えて始めるときも同じ。選べる問題が無ければ、それを知らせる。
 * プレイ画面から戻ってきたときは、選んでおいた問題の盤面を、プレイ画面で盤面があった所から縮めて収める。ジグソーは初めから見せ、縮む盤面と重なる見出し・操作は盤面が通り過ぎてから現す。
 *
 * 前回図鑑を見たときからの変化は、変化をまだ見せていないレベルのカードの点で示し、各レベルの台紙を初めて開いたときに一度だけ見せる。
 * 見せるときは、台紙と数を前回の姿で描き始め、変化したマスを1つずつ押していき、押してマスに着くたびに、そのレベルのカードの数・状態ごとの数・解いた数を今の数へ数え上げる。
 * ページが見えるまでは見せ始めない。画面を押すかキーを押すと最後の姿まで飛ばす。動きを減らす設定では、押さずに変化したマスへ印を載せる。
 * 選んでおいた問題が変化したマスのとき、変化を押して返している間は、選んだ問題の欄も選んだピースの姿も出さず、選んだ状態だけを保つ。返し終えたら、ピースから欄を広げて現す。
 * プレイ画面から戻ってきても、表示を控えている間は盤面を収めない。
 *
 * 絞り込みは開いているレベルの台紙にかけ、当たった問題を前に詰め、当たらなかった問題を薄くして後ろに並べる。条件は保存せず、開いたときは条件なしで始め、レベルを切り替えると外す。
 * 条件は、かけたレベルを添えて持ち、選ぶ前に最初に開くレベルが変わったときも、ほかのレベルには持ち越さない。条件を変えると台紙を先頭までスクロールし、前に集めた問題を見せる。
 * 変化は絞り込みの無い台紙で見せる。見せている途中で絞り込みを開くか条件を選ぶと、見せ終えたものとする。
 * 遊び方・チュートリアル・見方・絞り込み・成績は、見出しの1つのメニューから開く。メニューのボタンと「ランダムに遊ぶ」を押したタップは、最後の姿まで飛ばしたうえでそのまま操作する。
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
  const [selectedKey, setSelectedKey] = useState<SelectedProblemKey | null>(
    initialSelectedKey,
  );
  // 「ランダムに遊ぶ」で始める問題。そのピースから広げる盤面の写しの元として描く。
  const [launchingProblem, setLaunchingProblem] = useState<ZukanProblem | null>(
    null,
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
  const selectedPanelRef = useRef<HTMLElement>(null);
  const selectedAreaRef = useRef<HTMLDivElement>(null);
  const [coveredBottomHeight, setCoveredBottomHeight] = useState(0);
  const headerActionsRef = useRef<HTMLDivElement>(null);
  const playRandomRef = useRef<HTMLButtonElement>(null);
  const launchRef = useRef<HTMLDivElement>(null);
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

  /**
   * 押していく演出を最後まで押した・飛ばしたときに、見せ終えたとする。表示を控えていた選んだ問題は、利用者がピースを選んだときと同じく、ピースから広げて現す。
   * 演出の時計とタップで呼ばれ、React の描画の外にいるので、欄を描き終えてから広げられる。
   */
  function finishLevelRevealShowingSelected(difficulty: DifficultyLevel) {
    if (!isHoldingSelected || difficulty !== openDifficulty) {
      finishLevelReveal(difficulty, "done");
      return;
    }
    flushSync(() => {
      finishLevelReveal(difficulty, "done");
    });
    const piece = findSelectedSquareElement(scrollerRef.current);
    if (selectedPanelRef.current !== null && piece !== null) {
      revealSelectedProblem(selectedPanelRef.current, piece);
    }
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
      if (appearance === "marked") {
        finishLevelReveal(difficulty, "marked");
      } else {
        finishLevelRevealShowingSelected(difficulty);
      }
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
  // 台紙は描き直しが重いので、台紙の頭に添える要素は、示す値が変わったときだけ作り直す。
  // 当たった数は条件が無い間も場所を取っておくので、条件を付け外ししても状態ごとの数の折り返し方は変わらない。
  // 状態ごとの数がレベルによって2行に折り返す狭い画面では、レベルを切り替えても台紙が動かないよう、常に2行分を取っておく。
  const sheetHeader = useMemo(
    () => (
      <div className="flex items-start justify-between gap-x-3 max-[359px]:min-h-9">
        <div className="lg:hidden">
          <ZukanProblemStatusCounts counts={openStatusCounts} />
        </div>
        <ZukanMatchedCount
          matchedCount={shownMatchedCount}
          problemCount={openProblemCount}
        />
      </div>
    ),
    [openStatusCounts, shownMatchedCount, openProblemCount],
  );
  const chosenSelected = findSelectedProblem(
    openDifficulty,
    openProblems,
    selectedKey,
  );
  // 変化を押して返している間は、変化したピースが埋まるところを、選んだ姿や盤面で隠さない。選んだ問題が変化していなくても、狭い画面ではその欄が台の下端に重なる。
  // 選んだ状態は保ち、返し終えたら示す。動きを減らす設定で印を載せて見せるときは、隠すものが無いので控えない。
  const isHoldingSelected =
    chosenSelected !== null &&
    openAppearance === "animated" &&
    openRevealStatus === undefined &&
    changeIndices.length > 0;
  const selected = isHoldingSelected ? null : chosenSelected;
  const numberDigitCount = getZukanNumberDigitCount(zukan.problemCount);

  // 狭い画面では、選んだ問題をジグソーの下端に重ねる。重なった高さを台紙へ渡し、選んだピースが隠れないようにする。
  const isSelecting = selected !== null;
  useLayoutEffect(() => {
    const area = selectedAreaRef.current;
    const scroller = scrollerRef.current;
    if (!isSelecting || area === null || scroller === null) {
      setCoveredBottomHeight(0);
      return;
    }
    function updateCoveredBottomHeight() {
      if (area === null || scroller === null) {
        return;
      }
      const areaBox = area.getBoundingClientRect();
      const scrollerBox = scroller.getBoundingClientRect();
      const overlapsHorizontally =
        areaBox.left < scrollerBox.right && areaBox.right > scrollerBox.left;
      setCoveredBottomHeight(
        overlapsHorizontally
          ? Math.max(0, Math.round(scrollerBox.bottom - areaBox.top))
          : 0,
      );
    }
    updateCoveredBottomHeight();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(updateCoveredBottomHeight);
    observer.observe(area);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [isSelecting]);

  const handleSelect = useCallback(
    ({ difficulty, problemId }: ZukanProblem) => {
      const isOpening = selectedPanelRef.current === null;
      // 盤面をピースから広げるよう、欄を描いて、選んだピースが見える所へ送り終えてから測る。
      flushSync(() => {
        // 選んだあとに最後に遊んだレベルが変わっても、選んだ問題の台紙を開いたままにする。
        setChosenDifficulty(difficulty);
        setSelectedKey({ difficulty, problemId });
      });
      const piece = findSelectedSquareElement(scrollerRef.current);
      if (isOpening && selectedPanelRef.current !== null && piece !== null) {
        revealSelectedProblem(selectedPanelRef.current, piece);
      }
    },
    [],
  );

  /** 選択を解き、欄の盤面を選んでいたピースへ戻す。欄の面と「ランダムに遊ぶ」はすぐに入れ替え、盤面だけを動かす。 */
  const deselect = useCallback(() => {
    const panel = selectedPanelRef.current;
    const piece = findSelectedSquareElement(scrollerRef.current);
    const detached = panel === null ? null : detachSelectedProblemBoard(panel);
    flushSync(() => {
      setSelectedKey(null);
    });
    if (detached !== null) {
      concealSelectedProblemBoard(detached, piece);
    }
  }, []);

  function closeSelected() {
    // 選んだ問題の中の操作から閉じたときは、フォーカスを見失わないよう選んでいたマスへ戻す。
    findSelectedSquareElement(scrollerRef.current)?.focus({
      preventScroll: true,
    });
    deselect();
  }

  // ほかの画面から移ってきたときにフォーカスを見失わないよう、選んでおいた問題があればそのマスへ、無ければ見出しへ置く。
  const focusOnOpen = useEffectEvent(() => {
    const target =
      chosenSelected === null
        ? titleRef.current
        : findSquareElement(scrollerRef.current, chosenSelected.index);
    target?.focus({ preventScroll: true });
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
    changeLayerOpen(layer, true);
  }

  function handleFilterConditionsChange(conditions: ZukanFilterConditions) {
    finishOpenLevelReveal();
    setLevelFilter({ difficulty: openDifficulty, conditions });
    // 並びの途中を見ていても、条件で前に集めた問題から見られるようにする。選んだマスへは寄せ直さない。
    if (scrollerRef.current !== null) {
      scrollerRef.current.scrollTop = 0;
    }
  }

  /**
   * 盤面を画面に広げ、その下でプレイを始める。`fromPiece` を渡すと、`candidatePieces` を順に光らせ、
   * そのピースを持ち上げてから、ピースの位置と大きさから広げる。
   */
  function enterPlay(
    problem: ZukanProblem,
    board: HTMLElement | null,
    fromPiece?: HTMLElement,
    candidatePieces?: readonly HTMLElement[],
  ) {
    // 盤面をまだ描けていない（問題集を読み込んでいる途中など）ときは、広げるものが無いので、そのまま始める。
    if (
      board === null ||
      sceneRef.current === null ||
      !hasZukanPlayEntryBoard(board)
    ) {
      // プレイ画面へ移らずにゲームのホームが残ったときに、写しの元にしようとした盤面を残さない。
      setLaunchingProblem(null);
      onPlayProblem(problem);
      return;
    }
    isEnteringPlayRef.current = true;
    cancelPlayEntryRef.current = playZukanPlayEntry({
      board,
      fromPiece,
      candidatePieces,
      scene: sceneRef.current,
      onArrive() {
        onPlayProblem(problem);
      },
      onFinished() {
        isEnteringPlayRef.current = false;
        setLaunchingProblem(null);
      },
    });
  }

  const startSelectedPlay = withPlayStartSound(() => {
    if (selected !== null) {
      enterPlay(selected.problem, previewRef.current);
    }
  });

  // 盤面が広がる間に押し直しても、プレイを二重に始めず、始める音も鳴らさない。
  function handlePlaySelected() {
    if (!isEnteringPlayRef.current) {
      startSelectedPlay();
    }
  }

  const startRandomPlay = withPlayStartSound(() => {
    const problemId = selectRandomProblemId(openDifficulty);
    const problem = openProblems.find(
      (candidate) => candidate.problemId === problemId,
    );
    if (problem === undefined) {
      onRandomProblemUnavailable(openDifficulty);
      return;
    }
    // 選んでいた問題の盤面を出したまま、別の問題のピースから盤面を広げない。広げる写しの元にする盤面は、描いてから測る。
    flushSync(() => {
      setSelectedKey(null);
      setLaunchingProblem(problem);
    });
    // ゲームが選んだ問題のピースを見える所へ送り、そのピースの位置から盤面を広げる。ピースが盤面になって見えるようにする。
    const square = findSquareElement(
      scrollerRef.current,
      openProblems.indexOf(problem),
    );
    square?.scrollIntoView({ block: "nearest", inline: "nearest" });
    enterPlay(
      problem,
      launchRef.current,
      square ?? undefined,
      square === null
        ? []
        : listRandomCandidatePieces(scrollerRef.current, openProblems, square),
    );
  });

  function handlePlayRandom() {
    if (!isEnteringPlayRef.current) {
      startRandomPlay();
    }
  }

  // 特定のレベルを勧めないよう、チュートリアルを終えたら、「ランダムに遊ぶ」と同じく開いているレベルを始める。
  const tutorialPlayStart: TutorialPlayStart = {
    difficulty: openDifficulty,
    onStart: handlePlayRandom,
  };

  return (
    <GameHomeFrame ground={ground}>
      <div
        ref={sceneRef}
        className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 pt-2 sm:px-6 sm:pt-4 lg:pb-8"
      >
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

        <Tabs
          value={openDifficulty}
          onValueChange={handleLevelChange}
          activationMode="manual"
          className="mt-2 min-h-0 flex-1 gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_--spacing(72)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-x-8"
        >
          <div data-settle-chrome="" className="lg:col-span-full">
            <GameLevelCards levels={levelCards} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col lg:col-start-1 lg:row-start-2">
            <TabsContent
              value={openDifficulty}
              // 台紙のマスへ Tab で入れるので、見えない囲みを Tab の止まり先にしない。
              tabIndex={-1}
              className="flex min-h-0 flex-col"
            >
              <ZukanProblemSheet
                header={sheetHeader}
                difficulty={openDifficulty}
                problems={openProblems}
                arrangedProblems={arrangement.problems}
                matchedCount={shownMatchedCount}
                numberDigitCount={numberDigitCount}
                selectedProblemId={selected?.problem.problemId ?? null}
                coveredBottomHeight={coveredBottomHeight}
                changes={openChanges}
                changeStages={changeStages}
                scrollerRef={scrollerRef}
                onSelect={handleSelect}
                onDeselect={deselect}
              />
            </TabsContent>
          </div>
          {/* スマートフォンではジグソーの下、PC ではジグソーの横に、始める操作を置く。ピースを選んでいる間は、その問題の盤面と「遊ぶ」に替える。 */}
          <div className="relative grid content-start gap-y-4 pb-3 lg:col-start-2 lg:row-start-2 lg:pb-0">
            {/* 狭い画面では、選んでいる間も「ランダムに遊ぶ」を描いたまま欄の面で覆い、操作だけを止める。見えなくすると、閉じたときにボタンの移り変わりで一度消えて見えるため。 */}
            <div
              data-settle-chrome=""
              inert={selected !== null}
              className={`grid gap-y-4 ${selected === null ? "" : "lg:hidden"}`}
            >
              <div className="hidden lg:block">
                <ZukanProblemStatusCounts
                  counts={openStatusCounts}
                  layout="list"
                />
              </div>
              <Button ref={playRandomRef} size="lg" onClick={handlePlayRandom}>
                <Shuffle aria-hidden="true" />
                ランダムに遊ぶ
              </Button>
            </div>
            {selected !== null && (
              <div
                ref={selectedAreaRef}
                className="max-lg:absolute max-lg:-inset-x-4 max-lg:bottom-0 max-lg:sm:-inset-x-6"
              >
                <ZukanSelectedProblem
                  problem={selected.problem}
                  numberDigitCount={numberDigitCount}
                  describeProblem={describeProblem}
                  renderProblemPreview={renderProblemPreview}
                  panelRef={selectedPanelRef}
                  previewRef={previewRef}
                  onPlay={handlePlaySelected}
                  onClose={closeSelected}
                />
              </div>
            )}
          </div>
        </Tabs>
        {/* 「ランダムに遊ぶ」で始める問題の盤面。ピースの位置から広げる写しの元にするだけで、見せない。 */}
        {launchingProblem !== null && (
          <div
            ref={launchRef}
            inert
            aria-hidden="true"
            // 広げる写しと同じ大きさで描き、写しの中で盤面の大きさが変わらないようにする。
            className="pointer-events-none fixed top-0 left-0 flex size-[min(560px,96vw,62svh)] items-center justify-center opacity-0 [container-type:size]"
          >
            {renderProblemPreview(launchingProblem)}
          </div>
        )}
      </div>
    </GameHomeFrame>
  );
}

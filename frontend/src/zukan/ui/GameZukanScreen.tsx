import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type {
  ProblemFeature,
  ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
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
import {
  useZukanChangeReveal,
  type ZukanStampProgress,
} from "@/zukan/ui/GameZukanScreen/use-zukan-change-reveal";
import { ZukanChangeSummary } from "@/zukan/ui/GameZukanScreen/ZukanChangeSummary";
import { ZukanFilter } from "@/zukan/ui/GameZukanScreen/ZukanFilter";
import { ZukanLegend } from "@/zukan/ui/GameZukanScreen/ZukanLegend";
import {
  type ZukanLevelTab,
  ZukanLevelTabs,
} from "@/zukan/ui/GameZukanScreen/ZukanLevelTabs";
import { ZukanProblemDetail } from "@/zukan/ui/GameZukanScreen/ZukanProblemDetail";
import { ZukanProblemSheet } from "@/zukan/ui/GameZukanScreen/ZukanProblemSheet";
import { ZukanProblemStatusCounts } from "@/zukan/ui/GameZukanScreen/ZukanProblemStatusCounts";
import {
  countZukanNewlySolved,
  getZukanShownProblemStatus,
  getZukanStampSlot,
  type ZukanChangeAppearance,
  type ZukanChangeStage,
} from "@/zukan/ui/GameZukanScreen/zukan-change-reveal";
import type { ZukanFilterFeatureAxis } from "@/zukan/ui/GameZukanScreen/zukan-filter-appearance";
import { getZukanNumberDigitCount } from "@/zukan/ui/GameZukanScreen/zukan-problem-appearance";
import {
  ZukanBackLink,
  type ZukanGameEntryPath,
} from "@/zukan/ui/ZukanBackLink";
import {
  countZukanProblemsByStatus,
  type GameZukan,
  type ZukanDifficultySection,
  type ZukanProblem,
} from "@/zukan/zukan-collection";
import {
  arrangeZukanProblems,
  collectZukanLevelFeatures,
  countZukanFilterConditions,
  createZukanFilterMatcher,
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

type GameZukanScreenProps = {
  /** 見出しに使うゲームの表示名。 */
  gameTitle: string;
  zukan: GameZukan;
  /** 前回図鑑を見たときから、この図鑑までの変化。 */
  changes: ZukanChanges;
  /**
   * レベルの変化を見せ終えたとき。最後まで押したとき・飛ばしたとき・押している途中で別のレベルへ切り替えたときと、
   * 動きを減らす設定で印を載せた台紙を見せたとき。画面を離れて演出をやめたときは呼ばない。
   */
  onLevelChangesShown: (difficulty: DifficultyLevel) => void;
  /** 戻る導線の行き先。そのゲームの難易度選択。 */
  entryPath: ZukanGameEntryPath;
  /** 図鑑の問題を、新しいプレイとして始める。 */
  onPlayProblem: (problem: ZukanProblem) => void;
  /** 問題の、始めたときの盤面を見れば分かる特徴。詳細を出す1問についてだけ求める。求められなければ `null`。 */
  describeProblem: (problem: ZukanProblem) => readonly ProblemFeature[] | null;
  /** 絞り込みに使う、問題の特徴の軸。示す順。 */
  featureAxes: readonly ZukanFeatureAxis[];
  /**
   * 問題の、絞り込みに使う特徴の値を軸の ID ごとに返す。求められなければ `null`。
   * 絞り込みを開いている間と特徴の条件をかけている間だけ、開いているレベルの全問について求める。
   */
  findProblemFeatureValues: (
    problem: ZukanProblem,
  ) => ReadonlyMap<string, ProblemFeatureValue> | null;
};

type SelectedProblemKey = { difficulty: DifficultyLevel; problemId: ProblemId };

type SelectedProblem = { problem: ZukanProblem; index: number };

/**
 * 離脱の保存で図鑑が導き直されても、絞り込みで並びが変わっても選んだ問題を保つよう、選択は問題 ID で持ち、今の台紙の並びから引き直す。
 * 位置は台紙に並べた中の位置。
 */
function findSelectedProblem(
  difficulty: DifficultyLevel | null,
  problems: readonly ZukanProblem[],
  key: SelectedProblemKey | null,
): SelectedProblem | null {
  if (difficulty === null || difficulty !== key?.difficulty) {
    return null;
  }
  const index = problems.findIndex(
    ({ problemId }) => problemId === key.problemId,
  );
  const problem = problems[index];
  return problem ? { problem, index } : null;
}

function arrangeOpenProblems(
  section: ZukanDifficultySection | undefined,
  conditions: ZukanFilterConditions,
  levelFeatures: ZukanLevelFeatures | null,
): ZukanArrangement {
  if (section === undefined) {
    return { problems: [], matchedCount: 0 };
  }
  return countZukanFilterConditions(conditions) === 0
    ? { problems: section.problems, matchedCount: section.problems.length }
    : arrangeZukanProblems(
        section.problems,
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
 * 開いている台紙。選ぶまでは、そのゲームで最後にクリアまたは離脱したレベルを開き、記録が無ければ最も低いレベルを開く。
 * 離脱はこの画面を描いたあとに保存されることがあるので、選ぶまでは図鑑から求め直す。
 */
function findOpenSection(
  sections: readonly ZukanDifficultySection[],
  chosenDifficulty: DifficultyLevel | null,
  latestPlayedDifficulty: DifficultyLevel | null,
): ZukanDifficultySection | undefined {
  return (
    sections.find(({ difficulty }) => difficulty === chosenDifficulty) ??
    sections.find(({ difficulty }) => difficulty === latestPlayedDifficulty) ??
    sections[0]
  );
}

/**
 * レベルの変化を見せたあとの扱い。
 * - `marked`: 動きを減らす設定で印を載せて見せた。開いている間は印を残し、設定が変わっても押していく演出はしない。
 * - `done`: 見せ終えた。今の姿で描く。
 * 持たないレベルは、まだ変化を見せていない。
 */
type LevelRevealStatus = "marked" | "done";

/** 押していく順に並べた、台紙で変化したマスの台紙に並べた中の位置。並べた順。 */
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
 * 1ゲームの図鑑。難易度ごとの全問をマス目の台紙にし、タブで1枚ずつ切り替えて見せる。タブには各レベルの解いた数を添え、全レベルの進み具合を切り替えずに分かるようにする。
 * 画面の高さに収め、台紙だけをスクロールさせる。台紙の上には、そのレベルの問題の数を評価段階ごとと挑戦中・未挑戦に分けて示す。
 * マスを選んでいる間だけ、その問題の詳細と始める操作を出す。スマートフォンでは台紙の高さを変えずに下端へ重ね、PC では台紙の幅を変えないよう横の列を空けておく。
 * 詳細は、閉じるボタン・選んでいるマスをもう一度押す・Escape で閉じる。解いた問題の数は全問の数と並べた静かな計数で示し、タブに示す数の合計と常に一致させる。
 * 前回図鑑を見たときからの変化は、全レベルを合わせた1行の数と、変化をまだ見せていないレベルのタブの点で示し、各レベルの台紙を初めて開いたときに一度だけ見せる。
 * 見せるときは、台紙と数を前回の姿で描き始め、変化したマスを1つずつ押していき、押してマスに着くたびに、そのレベルのタブの数・状態ごとの数・解いた数を今の数へ数え上げる。
 * ページが見えるまでは見せ始めない。画面を押すかキーを押すと最後の姿まで飛ばす。
 * 絞り込みは開いているレベルの台紙にかけ、当たった問題を前に詰め、当たらなかった問題を薄くして後ろに並べる。条件は保存せず、開いたときは条件なしで始め、レベルを切り替えると外す。
 * 変化は絞り込みの無い台紙で見せる。見せている途中で絞り込みを開くか条件を選ぶと、見せ終えたものとする。
 * 状態ごとの数は、絞り込んでいても台紙の全問で数える。
 */
export function GameZukanScreen({
  gameTitle,
  zukan,
  changes,
  entryPath,
  onPlayProblem,
  describeProblem,
  onLevelChangesShown,
  featureAxes,
  findProblemFeatureValues,
}: GameZukanScreenProps) {
  const [chosenDifficulty, setChosenDifficulty] =
    useState<DifficultyLevel | null>(null);
  const [selectedKey, setSelectedKey] = useState<SelectedProblemKey | null>(
    null,
  );
  const [filterConditions, setFilterConditions] =
    useState<ZukanFilterConditions>(noZukanFilterConditions);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
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
  const sections = zukan.sections.filter(({ problems }) => problems.length > 0);
  const openSection = findOpenSection(
    sections,
    chosenDifficulty,
    zukan.latestPlayedDifficulty,
  );
  const openDifficulty = openSection?.difficulty ?? null;
  const openRevealStatus =
    openDifficulty === null ? undefined : revealStatuses.get(openDifficulty);
  const openChanges =
    openDifficulty === null || openRevealStatus === "done"
      ? undefined
      : changes.byDifficulty[openDifficulty];
  const needsLevelFeatures =
    isFilterOpen || hasZukanFeatureConditions(filterConditions);
  const levelFeatures = useMemo(
    () =>
      openSection === undefined || !needsLevelFeatures
        ? null
        : collectZukanLevelFeatures(
            openSection.problems,
            featureAxes,
            findProblemFeatureValues,
          ),
    [openSection, needsLevelFeatures, featureAxes, findProblemFeatureValues],
  );
  const isFiltering = countZukanFilterConditions(filterConditions) > 0;
  const arrangement = useMemo(
    () => arrangeOpenProblems(openSection, filterConditions, levelFeatures),
    [openSection, filterConditions, levelFeatures],
  );
  const performanceAxes = useMemo(
    () => listZukanPerformanceAxes(zukan),
    [zukan],
  );
  const openAppearance: ZukanChangeAppearance =
    prefersReducedMotion || openRevealStatus === "marked"
      ? "marked"
      : "animated";
  const changeIndices = useMemo(
    () =>
      openChanges === undefined
        ? []
        : listChangeIndices(arrangement.problems, openChanges),
    [arrangement, openChanges],
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
            arrangement.problems,
            changeIndices,
            openAppearance,
            stampProgress,
          ),
    [arrangement, openChanges, changeIndices, openAppearance, stampProgress],
  );
  const pendingChanges = listPendingChanges(openChanges, changeStages);

  const levelTabs: ZukanLevelTab[] = sections.map((section) => {
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
      matchedCount: isOpen && isFiltering ? arrangement.matchedCount : null,
    };
  });
  const shownSolvedCount = levelTabs.reduce(
    (total, { solvedCount }) => total + solvedCount,
    0,
  );
  const openStatusCounts =
    openSection === undefined
      ? undefined
      : countZukanProblemsByStatus(openSection.problems, (problem) =>
          getZukanShownProblemStatus(
            problem,
            pendingChanges.get(problem.problemId),
          ),
        );
  const selected = findSelectedProblem(
    openDifficulty,
    arrangement.problems,
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
      scrollerRef.current
        ?.querySelector<HTMLElement>(`[data-index="${selected.index}"]`)
        ?.focus({ preventScroll: true });
    }
    setSelectedKey(null);
  }

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
    if (
      openDifficulty !== null &&
      openChanges !== undefined &&
      openRevealStatus === undefined
    ) {
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
    setFilterConditions(noZukanFilterConditions);
  }

  function handleFilterOpenChange(open: boolean) {
    if (open) {
      finishOpenLevelReveal();
    }
    setIsFilterOpen(open);
  }

  function handleFilterConditionsChange(conditions: ZukanFilterConditions) {
    finishOpenLevelReveal();
    setFilterConditions(conditions);
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 pt-4 sm:px-6 sm:pt-6 lg:pb-8">
      <div>
        <ZukanBackLink to={entryPath} />
      </div>
      <header className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b-(length:--border-width-normal) pb-3">
        <h1 className="text-screen-title">{gameTitle}の図鑑</h1>
        <div className="flex flex-wrap items-center justify-end gap-x-1">
          <p className="text-supporting text-muted-foreground tabular-nums">
            解いた問題 {shownSolvedCount} / {zukan.problemCount}
          </p>
          <ZukanLegend />
          <ZukanFilter
            conditions={filterConditions}
            matchedCount={arrangement.matchedCount}
            featureAxes={listFilterFeatureAxes(levelFeatures, featureAxes)}
            performanceAxes={performanceAxes}
            open={isFilterOpen}
            onOpenChange={handleFilterOpenChange}
            onConditionsChange={handleFilterConditionsChange}
          />
        </div>
      </header>
      {hasChanges && (
        <div className="mt-3">
          <ZukanChangeSummary
            newlySolvedCount={changes.newlySolvedCount}
            raisedCount={changes.raisedCount}
          />
        </div>
      )}

      <div className="relative mt-4 flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_--spacing(64)] lg:grid-rows-[minmax(0,1fr)] lg:gap-8">
        <div className="flex min-h-0 flex-1 flex-col">
          {openSection && (
            <Tabs
              value={openSection.difficulty}
              onValueChange={handleLevelChange}
              className="min-h-0 flex-1"
            >
              <ZukanLevelTabs levels={levelTabs} />
              <TabsContent
                value={openSection.difficulty}
                className="flex min-h-0 flex-col"
              >
                {openStatusCounts && (
                  <div className="mt-1">
                    <ZukanProblemStatusCounts counts={openStatusCounts} />
                  </div>
                )}
                <ZukanProblemSheet
                  difficulty={openSection.difficulty}
                  problems={arrangement.problems}
                  matchedCount={isFiltering ? arrangement.matchedCount : null}
                  numberDigitCount={numberDigitCount}
                  selectedIndex={selected?.index ?? null}
                  changes={openChanges}
                  changeStages={changeStages}
                  scrollerRef={scrollerRef}
                  coveredBottomHeight={detailOverlayHeight}
                  onSelect={handleSelect}
                  onDeselect={handleDeselect}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
        <ZukanProblemDetail
          ref={detailRef}
          problem={selected?.problem ?? null}
          numberDigitCount={numberDigitCount}
          describeProblem={describeProblem}
          onPlay={onPlayProblem}
          onClose={closeDetail}
          onOverlayHeightChange={setDetailOverlayHeight}
        />
      </div>
    </div>
  );
}

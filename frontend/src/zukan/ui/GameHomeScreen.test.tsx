import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import {
  leavePlayBoard,
  _private as playBoardReturnPrivate,
} from "@/components/play-board-return";
import { type DifficultyLevel, difficultyLevels } from "@/games/difficulty";
import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import { createNanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import type { ProblemId } from "@/games/problem-id";
import {
  GameHomeScreen,
  type GameHomeScreenProps,
  type ZukanFeatureAxis,
} from "@/zukan/ui/GameHomeScreen";
import { _private as playEntryPrivate } from "@/zukan/ui/GameHomeScreen/zukan-play-entry";
import type {
  GameZukan,
  ZukanDifficultySection,
  ZukanProblem,
} from "@/zukan/zukan-collection";
import { noZukanChanges, type ZukanChanges } from "@/zukan/zukan-last-viewed";

function createUntouchedProblems(
  difficulty: DifficultyLevel,
  firstNumber: number,
  count: number,
): ZukanProblem[] {
  return Array.from({ length: count }, (_, index) => ({
    kind: "unsolved",
    number: firstNumber + index,
    difficulty,
    problemId: `p-${difficulty}-${index}`,
    attempted: false,
  }));
}

const levelOneProblems = createUntouchedProblems("1", 1, 3);

const levelThreeProblems: ZukanProblem[] = [
  {
    kind: "solved",
    number: 5,
    difficulty: "3",
    problemId: "p-a",
    bestScore: 92,
    fastestElapsedMs: 83_000,
    fewestMoves: { completionMoveCount: 21, optimalMoveCount: 20 },
    fewestMistakes: 0,
    firstClearedAt: new Date(2026, 9, 30, 12).getTime(),
  },
  {
    kind: "unsolved",
    number: 6,
    difficulty: "3",
    problemId: "p-b",
    attempted: true,
  },
  {
    kind: "solved",
    number: 7,
    difficulty: "3",
    problemId: "p-c",
    bestScore: 70,
    fastestElapsedMs: 3_725_000,
    fewestMoves: null,
    fewestMistakes: null,
    firstClearedAt: new Date(2026, 9, 31, 12).getTime(),
  },
  {
    kind: "unsolved",
    number: 8,
    difficulty: "3",
    problemId: "p-d",
    attempted: false,
  },
];

const problemsByDifficulty: Record<DifficultyLevel, readonly ZukanProblem[]> = {
  "1": levelOneProblems,
  "2": createUntouchedProblems("2", 4, 1),
  "3": levelThreeProblems,
  "4": createUntouchedProblems("4", 9, 1),
  "5": createUntouchedProblems("5", 10, 1),
};

function createSection(
  difficulty: DifficultyLevel,
  problems: readonly ZukanProblem[],
): ZukanDifficultySection {
  return {
    difficulty,
    problems,
    solvedCount: problems.filter(({ kind }) => kind === "solved").length,
  };
}

const zukan: GameZukan = {
  sections: difficultyLevels.map(({ id }) =>
    createSection(id, problemsByDifficulty[id]),
  ),
  problemCount: 1200,
  solvedCount: 2,
  latestPlayedDifficulty: "3",
};

const onPlayProblem = vi.fn();
/** 開いているレベルの、図鑑で前に置いた問題から、避ける問題を除いた最初の問題を選ぶ。 */
function selectFirstProblemId(
  difficulty: DifficultyLevel,
  avoidedProblemId?: ProblemId,
): ProblemId | null {
  return (
    problemsByDifficulty[difficulty].find(
      ({ problemId }) => problemId !== avoidedProblemId,
    )?.problemId ?? null
  );
}
const selectRandomProblemId = vi.fn(selectFirstProblemId);
const onRandomProblemUnavailable = vi.fn();
const onLevelChangesShown = vi.fn();
/** 特徴を求められない問題を除き、問題ごとに違う特徴を返す。 */
const describeProblem = vi.fn(({ problemId }: ZukanProblem) =>
  problemId === "p-1-0"
    ? null
    : [
        { label: "盤面", value: "9×9" },
        { label: "地雷", value: `${problemId.at(-1)?.charCodeAt(0)}個` },
      ],
);

const featureAxes: readonly ZukanFeatureAxis[] = [
  {
    id: "clues",
    countRangeWidth: 3,
    display: { label: "初期数字", valueFormat: { kind: "count", unit: "個" } },
  },
];
/** レベル 3 の問題だけ初期数字の数を変え、ほかのレベルは同じ数にする。 */
const clueCounts: Record<string, number> = {
  "p-a": 24,
  "p-b": 25,
  "p-c": 24,
  "p-d": 26,
};
/** 問題ごとに、始めたときの盤面の代わりに問題 ID を描く。プレイ画面の盤面と同じ目印を持たせる。 */
function renderMarkedProblemPreview({ problemId }: ZukanProblem) {
  return <p data-play-entry-board="">{`${problemId}の盤面`}</p>;
}
const renderProblemPreview = vi.fn(renderMarkedProblemPreview);
const findProblemFeatureValues = vi.fn(
  ({ problemId }: ZukanProblem) =>
    new Map([
      ["clues", { kind: "count", count: clueCounts[problemId] ?? 24 } as const],
    ]),
);

/** 開いているレベル 3 の記録2件と、ほかのレベルの記録1件。 */
const playRecords = (["3", "3", "1"] as const).map((difficulty, index) =>
  createNanpurePlayRecord({
    difficulty,
    problemIdentity: createNanpureProblemIdentity("naked-single", 41 + index),
    startedAt: 1_000 + index * 100_000,
    completedAt: 91_000 + index * 100_000,
    result: {
      elapsedMs: 90_000,
      mistakeCount: index,
      undoCount: 0,
      restartCount: 0,
    },
  }),
);

function createScreen(
  shownZukan: GameZukan = zukan,
  changes: ZukanChanges = noZukanChanges,
  initialSelectedProblemId: ProblemId | null = null,
  renderTutorial?: GameHomeScreenProps["renderTutorial"],
) {
  return (
    <MemoryRouter>
      <GameHomeScreen
        gameId="nanpure"
        gameTitle="ナンプレ"
        pictogramSvg="<svg></svg>"
        zukan={shownZukan}
        changes={changes}
        initialSelectedProblemId={initialSelectedProblemId}
        ground={<div data-testid="ground" />}
        selectRandomProblemId={selectRandomProblemId}
        onRandomProblemUnavailable={onRandomProblemUnavailable}
        onPlayProblem={onPlayProblem}
        onLevelChangesShown={onLevelChangesShown}
        describeProblem={describeProblem}
        renderProblemPreview={renderProblemPreview}
        featureAxes={featureAxes}
        findProblemFeatureValues={findProblemFeatureValues}
        renderHowToPlayDialog={({ open }) =>
          open ? <p>遊び方のダイアログ</p> : null
        }
        renderTutorial={renderTutorial}
        records={playRecords}
        playRecordDisplay={nanpurePlayRecordDisplay}
      />
    </MemoryRouter>
  );
}

function renderScreen(
  shownZukan: GameZukan = zukan,
  changes: ZukanChanges = noZukanChanges,
  initialSelectedProblemId: ProblemId | null = null,
  renderTutorial?: GameHomeScreenProps["renderTutorial"],
) {
  return render(
    createScreen(shownZukan, changes, initialSelectedProblemId, renderTutorial),
  );
}

function getSheet(name: string): HTMLElement {
  return screen.getByRole("group", { name });
}

function getSquare(sheetName: string, numberLabel: string): HTMLElement {
  return within(getSheet(sheetName)).getByRole("button", {
    name: new RegExp(`^${numberLabel} `),
  });
}

/** ゲームの名前と解いた数を示す、ゲームのホームの見出しの領域。 */
function getGameHeading(): HTMLElement {
  const heading = screen
    .getByRole("heading", { level: 1, name: "ナンプレ" })
    .closest("header");
  if (heading === null) {
    throw new Error("ゲームのホームの見出しの領域が無い");
  }
  return heading;
}

/** これから遊ぶ1問の盤面と、始める操作。 */
function getStage(): HTMLElement {
  return screen.getByRole("region", { name: "これから遊ぶ問題" });
}

/** これから遊ぶ問題に示した番号。出題できる問題が無ければ `null`。 */
function readStageNumber(): string | null {
  return within(getStage()).queryByText(/^No\.\d+$/)?.textContent ?? null;
}

/** これから遊ぶ問題の盤面を描く、読み上げず操作も受けない枠。 */
function getPreviewFrame(): HTMLElement {
  const frame = getStage().querySelector<HTMLElement>("[inert]");
  if (frame === null) {
    throw new Error("盤面を描く枠が無い");
  }
  return frame;
}

function getPlayButton(): HTMLElement {
  return within(getStage()).getByRole("button", { name: "遊ぶ" });
}

function play() {
  fireEvent.click(getPlayButton());
}

function getShuffleButton(): HTMLElement {
  return within(getStage()).getByRole("button", { name: "別の問題" });
}

function shuffle() {
  fireEvent.click(getShuffleButton());
}

function selectSquare(sheetName: string, numberLabel: string) {
  fireEvent.click(getSquare(sheetName, numberLabel));
}

/** 台紙で、選んだ姿のマスの番号。 */
function listCurrentSquareNumbers(): (string | undefined)[] {
  return screen
    .queryAllByRole("button", { current: true })
    .map((square) => square.getAttribute("aria-label")?.split(" ")[0]);
}

/**
 * 台紙の要素を、見えている並びの順にする。台紙は要素を置き直さず、条件に当たらなかったマスを CSS の `order` で区切りの後ろへ並べる。
 * jsdom はクラスの `order` を計算しないので、台紙が並べる印で順を決める。
 */
function listShownSheetChildren(sheetName: string): Element[] {
  function shownOrder(element: Element): number {
    if (element.hasAttribute("data-filtered-out")) {
      return 2;
    }
    return element.hasAttribute("data-filter-boundary") ? 1 : 0;
  }
  return [...getSheet(sheetName).children].sort(
    (a, b) => shownOrder(a) - shownOrder(b),
  );
}

/** 台紙に見えている順の番号と、絞り込みの条件に当たらなかったマスの印。 */
function listSquareOrder(sheetName: string): string[] {
  return listShownSheetChildren(sheetName)
    .filter((child) => child.getAttribute("type") === "button")
    .map((square) => {
      const name = square.getAttribute("aria-label") ?? "";
      const number = name.split(" ")[0] ?? "";
      return name.endsWith("絞り込みの条件外") ? `${number} 条件外` : number;
    });
}

/** 台紙の上に添えた、条件に当たる問題の数。見えていなければ `null`。 */
function getShownMatchedCount(): string | null {
  const matchedCount = document.querySelector("[data-matched-count]");
  if (
    matchedCount === null ||
    matchedCount.getAttribute("aria-hidden") === "true"
  ) {
    return null;
  }
  const shown = matchedCount.cloneNode(true) as Element;
  for (const hidden of shown.querySelectorAll('[aria-hidden="true"]')) {
    hidden.remove();
  }
  return shown.textContent;
}

function getMenuButton(): HTMLElement {
  return screen.getByRole("button", { name: /^メニュー/ });
}

function openMenu() {
  fireEvent.pointerDown(getMenuButton(), { button: 0, ctrlKey: false });
}

/** 見出しのメニューを開き、層を開く項目を選ぶ。 */
function openFromMenu(itemName: string | RegExp) {
  openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: itemName }));
}

/** 絞り込みの選択肢。読み上げ名は、名前に当たる問題の数を添えた「名前、数問」。 */
function getFilterOption(
  panel: HTMLElement,
  groupName: string,
  optionName: string,
): HTMLElement {
  return within(
    within(panel).getByRole("toolbar", { name: groupName }),
  ).getByRole("button", { name: new RegExp(`^${optionName}、`) });
}

function chooseFilterOption(
  panel: HTMLElement,
  groupName: string,
  optionName: string,
) {
  fireEvent.click(getFilterOption(panel, groupName, optionName));
}

function listFilterOptionNames(panel: HTMLElement, groupName: string) {
  return within(within(panel).getByRole("toolbar", { name: groupName }))
    .getAllByRole("button")
    .map((option) => option.getAttribute("aria-label"));
}

/** 押せない選択肢の名前。 */
function listDisabledFilterOptionNames(panel: HTMLElement) {
  return within(panel)
    .getAllByRole("toolbar")
    .flatMap((toolbar) => within(toolbar).getAllByRole("button"))
    .filter((option) => option.hasAttribute("disabled"))
    .map((option) => option.getAttribute("aria-label"));
}

/** 要素の入れ子と、要素ごとの属性の名前。文字・属性の値は除く。 */
function describeElementStructure(element: Element): string {
  const attributeNames = [...element.attributes]
    .map(({ name }) => name)
    .sort()
    .join(",");
  const children = [...element.children].map(describeElementStructure).join("");
  return `<${element.tagName} ${attributeNames}>${children}</${element.tagName}>`;
}

function getLevelTab(label: string): HTMLElement {
  return screen.getByRole("tab", { name: new RegExp(`^${label}`) });
}

/** 読み上げる名前と同じく、見せるだけの要素を除いたレベルの文字。 */
function readLevelCardName(tab: Element): string | null {
  const shown = tab.cloneNode(true) as Element;
  for (const hidden of shown.querySelectorAll('[aria-hidden="true"]')) {
    hidden.remove();
  }
  return shown.textContent;
}

/** レベルに示した「解いた数 / 全問の数」。 */
function readLevelCardCount(tab: Element): string | undefined {
  const [, problemCount, solvedCount] =
    readLevelCardName(tab)?.match(/(\d+)問中(\d+)問を解いた/) ?? [];
  return problemCount === undefined
    ? undefined
    : `${solvedCount} / ${problemCount}`;
}

function chooseLevel(label: string) {
  fireEvent.mouseDown(getLevelTab(label), { button: 0, ctrlKey: false });
}

function getShownSheetNames(): (string | null)[] {
  return screen
    .getAllByRole("group", { name: /の問題$/ })
    .map((sheet) => sheet.getAttribute("aria-label"));
}

/** 開いているレベルの名前。 */
function readOpenLevel(): string | undefined {
  return readLevelCardName(screen.getByRole("tab", { selected: true }))?.split(
    "、",
  )[0];
}

function getStatusCounts(): HTMLElement {
  return screen.getByRole("list", { name: "状態ごとの問題の数" });
}

function getStatusCountNames(): (string | null)[] {
  return within(getStatusCounts())
    .getAllByRole("listitem")
    .map((item) => item.getAttribute("aria-label"));
}

afterEach(() => {
  cleanup();
});

describe("GameHomeScreen", () => {
  beforeEach(() => {
    onPlayProblem.mockClear();
    selectRandomProblemId.mockReset();
    onRandomProblemUnavailable.mockClear();
    selectRandomProblemId.mockImplementation(selectFirstProblemId);
    onLevelChangesShown.mockClear();
    findProblemFeatureValues.mockClear();
    describeProblem.mockClear();
    renderProblemPreview.mockClear();
  });

  describe("最後に遊んだレベルがある場合", () => {
    beforeEach(() => {
      renderScreen();
    });

    test("ゲーム名の見出しと、解いた問題の数を全問の数と並べて示すこと", () => {
      const heading = screen.getByRole("heading", { level: 1 });
      const solvedCount = screen.getByText("解いた問題 2 / 1200");

      expect(heading.textContent).toBe("ナンプレ");
      expect(solvedCount).toBeTruthy();
    });

    test("解いた問題の数を、全問の数と並べた読み上げ名で見出しに置くこと", () => {
      const spokenCount = within(getGameHeading()).getByText(
        "1200問中2問を解いた",
      );

      expect(spokenCount).toBeTruthy();
    });

    test("問題のあるレベルを並べ、それぞれにそのレベルの解いた問題の数を添えること", () => {
      const tabNames = within(screen.getByRole("tablist", { name: "レベル" }))
        .getAllByRole("tab")
        .map(readLevelCardName);

      expect(tabNames).toEqual([
        "レベル 1、3問中0問を解いた",
        "レベル 2、1問中0問を解いた",
        "レベル 3、4問中2問を解いた",
        "レベル 4、1問中0問を解いた",
        "レベル 5、1問中0問を解いた",
      ]);
    });

    test("最後に遊んだレベルを開き、そのレベルの台紙だけを示すこと", () => {
      const openLevel = readOpenLevel();
      const sheetNames = getShownSheetNames();

      expect(openLevel).toBe("レベル 3");
      expect(sheetNames).toEqual(["レベル 3の問題"]);
    });

    test("レベルを選ぶと、そのレベルの台紙に切り替えること", () => {
      chooseLevel("レベル 1");
      const sheetNames = getShownSheetNames();

      expect(sheetNames).toEqual(["レベル 1の問題"]);
    });

    test("レベルで右矢印キーを押すと、次のレベルへフォーカスだけを移し、台紙を切り替えないこと", async () => {
      const tab = getLevelTab("レベル 3");
      tab.focus();

      fireEvent.keyDown(tab, { key: "ArrowRight" });
      await waitFor(() => {
        expect(document.activeElement).toBe(getLevelTab("レベル 4"));
      });
      const sheetNames = getShownSheetNames();
      const selectedTab = screen.getByRole("tab", { selected: true });

      expect(sheetNames).toEqual(["レベル 3の問題"]);
      expect(selectedTab).toBe(getLevelTab("レベル 3"));
    });

    test("フォーカスのあるレベルで Enter を押すと、そのレベルの台紙に切り替えること", () => {
      const tab = getLevelTab("レベル 4");
      tab.focus();

      fireEvent.keyDown(tab, { key: "Enter" });
      const sheetNames = getShownSheetNames();

      expect(sheetNames).toEqual(["レベル 4の問題"]);
    });

    test("開いたときに、ゲーム名の見出しへフォーカスを置くこと", () => {
      const focused = document.activeElement;

      expect(focused).toBe(screen.getByRole("heading", { level: 1 }));
    });

    test("開いたときに、開いたレベルの問題をゲームに一度だけ選ばせ、選んだ1問の特徴と盤面だけを求めること", () => {
      const selectCalls = selectRandomProblemId.mock.calls;
      const describedProblemIds = new Set(
        describeProblem.mock.calls.map(([{ problemId }]) => problemId),
      );
      const renderedProblemIds = new Set(
        renderProblemPreview.mock.calls.map(([{ problemId }]) => problemId),
      );

      expect(selectCalls).toEqual([["3"]]);
      expect(describedProblemIds).toEqual(new Set(["p-a"]));
      expect(renderedProblemIds).toEqual(new Set(["p-a"]));
    });

    test("ゲームが選んだ問題を、これから遊ぶ問題として番号と始めたときの盤面で示し、台紙のそのマスだけを選んだ姿にすること", () => {
      const stageNumber = readStageNumber();
      const board = within(getPreviewFrame()).getByText("p-aの盤面");
      const currentSquares = listCurrentSquareNumbers();

      expect(stageNumber).toBe("No.0005");
      expect(board).toBeTruthy();
      expect(currentSquares).toEqual(["No.0005"]);
    });

    test("台紙のマスを番号の順に並べ、それぞれの状態を読み上げ名で示すこと", () => {
      const squareNames = within(getSheet("レベル 3の問題"))
        .getAllByRole("button")
        .map((square) => square.getAttribute("aria-label"));

      expect(squareNames).toEqual([
        "No.0005 レベル 3 最高スコア92点",
        "No.0006 レベル 3 挑戦中",
        "No.0007 レベル 3 最高スコア70点",
        "No.0008 レベル 3 未挑戦",
      ]);
    });

    test("台紙で、これから遊ぶ問題のマスだけを Tab で止まるマスにすること", () => {
      const tabStops = within(getSheet("レベル 3の問題"))
        .getAllByRole("button")
        .filter((square) => square.tabIndex === 0)
        .map((square) => square.getAttribute("aria-label")?.split(" ")[0]);

      expect(tabStops).toEqual(["No.0005"]);
    });

    test("成績を常には示さないこと", () => {
      const performance = screen.queryByRole("dialog", { name: "成績" });

      expect(performance).toBeNull();
    });

    test("メニューから成績を開くと、開いているレベルの記録だけから自己ベストと推移を示すこと", async () => {
      openFromMenu("成績");
      const performance = await screen.findByRole("dialog", { name: "成績" });

      expect(within(performance).getByText("レベル 3")).toBeTruthy();
      expect(
        within(performance).getByRole("region", { name: "自己ベスト" }),
      ).toBeTruthy();
      expect(
        within(performance).getByRole("combobox", { name: "推移する指標" }),
      ).toBeTruthy();
      expect(within(performance).getByText("2件")).toBeTruthy();
    });

    test("マスの見方を常には示さないこと", () => {
      const legend = screen.queryByRole("list", { name: "マスの見方" });

      expect(legend).toBeNull();
    });

    test("メニューから見方を開くと、評価段階の高い順に続けて挑戦中・未挑戦のマスの見方を示すこと", async () => {
      openFromMenu("見方");
      const legend = await screen.findByRole("list", { name: "マスの見方" });

      const items = within(legend)
        .getAllByRole("listitem")
        .map((item) => item.textContent);

      expect(items).toEqual([
        "perfect",
        "great",
        "good",
        "clear",
        "挑戦中",
        "未挑戦",
      ]);
    });

    test("開いているレベルの問題の数を、状態の名前を出さずに数だけ、評価段階の高い順に続けて挑戦中・未挑戦の順に、数の無い状態も含めて示すこと", () => {
      const counts = within(getStatusCounts())
        .getAllByRole("listitem")
        .map((item) => item.textContent);

      expect(counts).toEqual(["0", "1", "0", "1", "1", "1"]);
    });

    test("状態ごとの数の読み上げ名に、状態の名前を含めること", () => {
      const names = getStatusCountNames();

      expect(names).toEqual([
        "perfect 0問",
        "great 1問",
        "good 0問",
        "clear 1問",
        "挑戦中 1問",
        "未挑戦 1問",
      ]);
    });

    test("解いた問題の無いレベルでも、状態ごとの数を示すこと", () => {
      chooseLevel("レベル 1");
      const names = getStatusCountNames();

      expect(names).toEqual([
        "perfect 0問",
        "great 0問",
        "good 0問",
        "clear 0問",
        "挑戦中 0問",
        "未挑戦 3問",
      ]);
    });

    test("前回からの変化が無ければ、変化を示さないこと", () => {
      const changedSquares = within(getSheet("レベル 3の問題"))
        .getAllByRole("button")
        .filter((square) =>
          square.getAttribute("aria-label")?.includes("前回から"),
        );

      expect(changedSquares).toEqual([]);
    });

    test("マスを選ぶと、ゲームに選ばせ直さずに、その問題をこれから遊ぶ問題にし、そのマスを選んだ姿にすること", () => {
      selectSquare("レベル 3の問題", "No.0007");
      const stageNumber = readStageNumber();
      const board = within(getPreviewFrame()).getByText("p-cの盤面");
      const currentSquares = listCurrentSquareNumbers();

      expect(stageNumber).toBe("No.0007");
      expect(board).toBeTruthy();
      expect(currentSquares).toEqual(["No.0007"]);
      expect(selectRandomProblemId.mock.calls).toEqual([["3"]]);
    });

    test("遊ぶを押すと、これから遊ぶ問題を始め、ゲームに選ばせ直さないこと", () => {
      play();

      expect(onPlayProblem.mock.calls).toEqual([[levelThreeProblems[0]]]);
      expect(selectRandomProblemId.mock.calls).toEqual([["3"]]);
    });

    test("盤面を押すと、遊ぶと同じくこれから遊ぶ問題を始めること", () => {
      fireEvent.click(within(getPreviewFrame()).getByText("p-aの盤面"));

      expect(onPlayProblem.mock.calls).toEqual([[levelThreeProblems[0]]]);
    });

    test("別の問題を押すと、プレイを始めずに、今の問題を除いてゲームに選ばせた問題をこれから遊ぶ問題にすること", () => {
      shuffle();
      const stageNumber = readStageNumber();
      const currentSquares = listCurrentSquareNumbers();

      expect(selectRandomProblemId.mock.calls).toEqual([["3"], ["3", "p-a"]]);
      expect(stageNumber).toBe("No.0006");
      expect(currentSquares).toEqual(["No.0006"]);
      expect(onPlayProblem).not.toHaveBeenCalled();
    });

    test("まだ開いていないレベルを開くと、そのレベルの問題をゲームに選ばせ、これから遊ぶ問題にすること", () => {
      chooseLevel("レベル 1");
      const stageNumber = readStageNumber();

      expect(selectRandomProblemId.mock.calls).toEqual([["3"], ["1"]]);
      expect(stageNumber).toBe("No.0001");
    });

    describe("マスを選んでから、ほかのレベルを開いて戻った場合", () => {
      beforeEach(() => {
        selectSquare("レベル 3の問題", "No.0007");
        chooseLevel("レベル 1");
        chooseLevel("レベル 3");
      });

      test("選んだ問題をこれから遊ぶ問題として保ち、ゲームに選ばせ直さないこと", () => {
        const stageNumber = readStageNumber();
        const currentSquares = listCurrentSquareNumbers();

        expect(stageNumber).toBe("No.0007");
        expect(currentSquares).toEqual(["No.0007"]);
        expect(selectRandomProblemId.mock.calls).toEqual([["3"], ["1"]]);
      });
    });

    test("ホームへ戻る導線を示すこと", () => {
      const backLink = screen.getByRole("link", { name: "戻る" });

      expect(backLink.getAttribute("href")).toBe("/");
    });

    test("メニューから遊び方を開くと、ゲームの遊び方を開くこと", async () => {
      openFromMenu("遊び方");

      const dialog = await screen.findByText("遊び方のダイアログ");

      expect(dialog).toBeTruthy();
    });

    test("チュートリアルを渡さなければ、メニューにチュートリアルを出さないこと", () => {
      openMenu();

      const item = screen.queryByRole("menuitem", { name: "チュートリアル" });

      expect(item).toBeNull();
    });

    test("絞り込みを開くまで、問題の特徴の値を求めないこと", () => {
      const calls = findProblemFeatureValues.mock.calls;

      expect(calls).toEqual([]);
    });

    test("絞り込みの条件をかけるまで、マスを並べ替えず、当たった数を示さないこと", () => {
      const order = listSquareOrder("レベル 3の問題");
      const menuButton = getMenuButton();
      const matchedCount = getShownMatchedCount();

      expect(order).toEqual(["No.0005", "No.0006", "No.0007", "No.0008"]);
      expect(menuButton.getAttribute("aria-label")).toBe("メニュー");
      expect(matchedCount).toBeNull();
    });
  });

  describe("台紙の場所の大きさが分かり、マスにフォーカスがある場合", () => {
    let square: HTMLElement;

    beforeEach(() => {
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 0, 320, 200),
      );
      renderScreen();
      square = getSquare("レベル 3の問題", "No.0005");
      square.focus();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test("右矢印キーを押すと、次のマスへフォーカスを移し、その問題をこれから遊ぶ問題にすること", () => {
      fireEvent.keyDown(square, { key: "ArrowRight" });
      const focused = document.activeElement;

      expect(focused?.getAttribute("aria-label")).toBe(
        "No.0006 レベル 3 挑戦中",
      );
      expect(focused?.getAttribute("tabindex")).toBe("0");
      expect(square.getAttribute("tabindex")).toBe("-1");
      expect(readStageNumber()).toBe("No.0006");
    });
  });

  describe("ゲームが問題を選べない場合", () => {
    beforeEach(() => {
      selectRandomProblemId.mockReturnValue(null);
      renderScreen();
    });

    test("盤面と番号の代わりに出題の条件に合う問題が無いことを示し、どのマスも選んだ姿にしないこと", () => {
      const notice = within(getStage()).getByText(
        "出題の条件に合う問題がありません",
      );
      const stageNumber = readStageNumber();
      const currentSquares = listCurrentSquareNumbers();

      expect(notice).toBeTruthy();
      expect(stageNumber).toBeNull();
      expect(currentSquares).toEqual([]);
    });

    test("遊ぶを押すと、プレイを始めず、開いているレベルで始められる問題が無かったと知らせること", () => {
      play();

      expect(onPlayProblem).not.toHaveBeenCalled();
      expect(onRandomProblemUnavailable.mock.calls).toEqual([["3"]]);
    });

    test("別の問題を押すと、開いているレベルで始められる問題が無かったと知らせること", () => {
      shuffle();

      expect(onRandomProblemUnavailable.mock.calls).toEqual([["3"]]);
    });

    describe("台紙でマスを選んだ場合", () => {
      beforeEach(() => {
        selectSquare("レベル 3の問題", "No.0006");
      });

      test("遊ぶを押すと、選んだ問題を始めること", () => {
        play();

        expect(onPlayProblem.mock.calls).toEqual([[levelThreeProblems[1]]]);
        expect(onRandomProblemUnavailable).not.toHaveBeenCalled();
      });
    });
  });

  describe("ゲームが今の問題のほかに問題を選べない場合", () => {
    beforeEach(() => {
      selectRandomProblemId.mockImplementation(
        (difficulty, avoidedProblemId) =>
          avoidedProblemId === undefined
            ? selectFirstProblemId(difficulty)
            : null,
      );
      renderScreen();
    });

    test("別の問題を押すと、今の問題を残し、替えられる問題が無かったと知らせること", () => {
      shuffle();
      const stageNumber = readStageNumber();

      expect(stageNumber).toBe("No.0005");
      expect(onRandomProblemUnavailable.mock.calls).toEqual([["3"]]);
    });
  });

  describe("チュートリアルを渡した場合", () => {
    beforeEach(() => {
      renderScreen(
        zukan,
        noZukanChanges,
        null,
        ({ open, onClose, playStart }) =>
          open ? (
            <div role="dialog" aria-label="チュートリアル">
              <button type="button" onClick={playStart.onStart}>
                {`${playStart.difficulty}を遊ぶ`}
              </button>
              <button type="button" onClick={onClose}>
                閉じる
              </button>
            </div>
          ) : null,
      );
    });

    test("チュートリアルを最初は開かないこと", () => {
      const dialog = screen.queryByRole("dialog", { name: "チュートリアル" });

      expect(dialog).toBeNull();
    });

    test("メニューで、チュートリアルを遊び方の次に置くこと", () => {
      openMenu();

      const items = screen
        .getAllByRole("menuitem")
        .map((item) => item.textContent);

      expect(items.slice(0, 2)).toEqual(["遊び方", "チュートリアル"]);
    });

    test("メニューからチュートリアルを開くと、ゲームのチュートリアルを開くこと", async () => {
      openFromMenu("チュートリアル");

      const dialog = await screen.findByRole("dialog", {
        name: "チュートリアル",
      });

      expect(dialog).toBeTruthy();
    });

    test("チュートリアルを閉じると、フォーカスをメニューのボタンへ戻すこと", async () => {
      openFromMenu("チュートリアル");
      fireEvent.click(await screen.findByRole("button", { name: "閉じる" }));

      await waitFor(() => {
        expect(document.activeElement).toBe(getMenuButton());
      });
    });

    describe("チュートリアルを開いている場合", () => {
      beforeEach(async () => {
        openFromMenu("チュートリアル");
        await screen.findByRole("dialog", { name: "チュートリアル" });
      });

      test("チュートリアルから遊び始めると、遊ぶと同じく、開いているレベルのこれから遊ぶ問題を始めること", () => {
        fireEvent.click(screen.getByRole("button", { name: "3を遊ぶ" }));

        expect(selectRandomProblemId.mock.calls).toEqual([["3"]]);
        expect(onPlayProblem.mock.calls).toEqual([[levelThreeProblems[0]]]);
      });
    });
  });

  describe("絞り込みを開いた場合", () => {
    let panel: HTMLElement;

    beforeEach(async () => {
      renderScreen();
      openFromMenu(/^絞り込み/);
      panel = await screen.findByRole("dialog", { name: "絞り込み" });
    });

    test("状態・問題の特徴・成績の種類ごとに、開いているレベルで選べる選択肢を、当たる問題の数を添えて示すこと", () => {
      const toolbarCount = within(panel).getAllByRole("toolbar").length;
      const groups = ["状態", "初期数字", "ミス", "手数"].map((name) => [
        name,
        listFilterOptionNames(panel, name),
      ]);

      expect(toolbarCount).toBe(4);
      expect(groups).toEqual([
        [
          "状態",
          [
            "perfect、0問",
            "great、1問",
            "good、0問",
            "clear、1問",
            "挑戦中、1問",
            "未挑戦、1問",
          ],
        ],
        ["初期数字", ["24個、2問", "25個、1問", "26個、1問"]],
        ["ミス", ["ミスなし、1問", "ミスあり、0問"]],
        ["手数", ["最短手数、0問", "最短より多い、1問"]],
      ]);
    });

    test("当たる問題が無い選択肢を押せなくすること", () => {
      const disabledNames = listDisabledFilterOptionNames(panel);

      expect(disabledNames).toEqual([
        "perfect、0問",
        "good、0問",
        "ミスあり、0問",
        "最短手数、0問",
      ]);
    });

    test("選択肢を選んでも、選択肢の中の要素の並びを変えないこと", () => {
      const option = getFilterOption(panel, "状態", "great");
      const before = describeElementStructure(option);

      fireEvent.click(option);
      const after = describeElementStructure(option);

      expect(option.getAttribute("aria-pressed")).toBe("true");
      expect(after).toBe(before);
    });

    test("開いているレベルの全問の特徴の値だけを求めること", () => {
      const problemIds = findProblemFeatureValues.mock.calls.map(
        ([problem]) => problem.problemId,
      );

      expect(problemIds).toEqual(["p-a", "p-b", "p-c", "p-d"]);
    });

    test("閉じて開き直しても、特徴の値を求め直さないこと", async () => {
      const callCount = findProblemFeatureValues.mock.calls.length;

      fireEvent.keyDown(panel, { key: "Escape" });
      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "絞り込み" })).toBeNull();
      });
      openFromMenu(/^絞り込み/);
      await screen.findByRole("dialog", { name: "絞り込み" });

      expect(findProblemFeatureValues).toHaveBeenCalledTimes(callCount);
    });

    test("条件を付け外ししても、見出し・レベル・状態ごとの数の並びの要素を足し引きしないこと", () => {
      const header = getGameHeading();
      const tabList = screen.getByRole("tablist", { name: "レベル" });
      const statusRow = getStatusCounts().parentElement as HTMLElement;
      const before = [header, tabList, statusRow].map(describeElementStructure);

      chooseFilterOption(panel, "状態", "未挑戦");
      const filtered = [header, tabList, statusRow].map(
        describeElementStructure,
      );
      fireEvent.click(within(panel).getByRole("button", { name: "解除" }));
      const cleared = [header, tabList, statusRow].map(
        describeElementStructure,
      );

      expect(filtered).toEqual(before);
      expect(cleared).toEqual(before);
    });

    test("条件をかけていない間も、メニューのボタンの条件の数の印の場所を見えなくして取っておくこと", () => {
      const mark = getMenuButton().querySelector("[data-condition-count-mark]");
      const hiddenBefore = mark?.classList.contains("invisible");

      chooseFilterOption(panel, "状態", "未挑戦");

      expect(hiddenBefore).toBe(true);
      expect(mark?.classList.contains("invisible")).toBe(false);
      expect(mark?.textContent).toContain("1");
    });

    describe("マスを選んでから並びを変えた場合", () => {
      beforeEach(() => {
        fireEvent.click(getSquare("レベル 3の問題", "No.0006"));
        chooseFilterOption(panel, "状態", "未挑戦");
      });

      test("条件外になった選んでいるマスを、Tab で止まるマスのまま保つこと", () => {
        const tabStops = within(getSheet("レベル 3の問題"))
          .getAllByRole("button")
          .filter((square) => square.tabIndex === 0);
        const currentSquares = within(getSheet("レベル 3の問題")).getAllByRole(
          "button",
          { current: true },
        );

        expect(tabStops).toEqual(currentSquares);
        expect(
          tabStops.map((square) => square.getAttribute("aria-label")),
        ).toEqual(["No.0006 レベル 3 挑戦中 絞り込みの条件外"]);
      });
    });

    test("条件が無い間は、解除を押せないことを示し、押しても何もしないこと", () => {
      const clearButton = within(panel).getByRole("button", { name: "解除" });
      clearButton.focus();

      fireEvent.click(clearButton);

      expect(clearButton.getAttribute("aria-disabled")).toBe("true");
      expect(getMenuButton().getAttribute("aria-label")).toBe("メニュー");
      expect(document.activeElement).toBe(clearButton);
    });

    describe("状態で絞った場合", () => {
      beforeEach(() => {
        chooseFilterOption(panel, "状態", "挑戦中");
        chooseFilterOption(panel, "状態", "未挑戦");
      });

      test("ほかの種類の選択肢には、選んだ状態の中で当たる問題の数を示し、無いものを押せなくすること", () => {
        const featureNames = listFilterOptionNames(panel, "初期数字");
        const disabledNames = listDisabledFilterOptionNames(panel);

        expect(featureNames).toEqual(["24個、0問", "25個、1問", "26個、1問"]);
        expect(disabledNames).toEqual([
          "perfect、0問",
          "good、0問",
          "24個、0問",
          "ミスなし、0問",
          "ミスあり、0問",
          "最短手数、0問",
          "最短より多い、0問",
        ]);
      });

      test("当たった問題を番号の順に前へ、当たらなかった問題を条件外として番号の順に後ろへ並べること", () => {
        const order = listSquareOrder("レベル 3の問題");

        expect(order).toEqual([
          "No.0006",
          "No.0008",
          "No.0005 条件外",
          "No.0007 条件外",
        ]);
      });

      test("台紙の上と絞り込みに当たった数を、メニューのボタンに条件の数を示し、レベルの数は変えないこと", () => {
        const openTab = screen.getByRole("tab", { selected: true });
        const panelCount = within(panel).getByText(/^該当/).textContent;
        const menuButton = getMenuButton();

        expect(readLevelCardName(openTab)).toBe("レベル 3、4問中2問を解いた");
        expect(getShownMatchedCount()).toBe("該当 2問");
        expect(panelCount).toBe("該当 2問");
        expect(menuButton.getAttribute("aria-label")).toBe(
          "メニュー、絞り込みの条件2つ",
        );
      });

      describe("絞り込みを閉じてメニューを開いた場合", () => {
        beforeEach(async () => {
          fireEvent.keyDown(panel, { key: "Escape" });
          await waitFor(() => {
            expect(
              screen.queryByRole("dialog", { name: "絞り込み" }),
            ).toBeNull();
          });
          openMenu();
        });

        test("メニューの絞り込みに条件の数を示すこと", () => {
          const filterItem = screen.getByRole("menuitem", {
            name: /^絞り込み/,
          });

          expect(filterItem.getAttribute("aria-label")).toBe(
            "絞り込み、条件2つ",
          );
          expect(filterItem.textContent).toBe("絞り込み2");
        });
      });

      test("状態ごとの数は、絞り込んでも台紙の全問で数えること", () => {
        const levelCounts = getStatusCountNames();

        expect(levelCounts).toEqual([
          "perfect 0問",
          "great 1問",
          "good 0問",
          "clear 1問",
          "挑戦中 1問",
          "未挑戦 1問",
        ]);
      });

      test("当たらなかった問題と当たった問題の間に区切りを入れること", () => {
        const boundaryIndex = listShownSheetChildren(
          "レベル 3の問題",
        ).findIndex((child) => child.hasAttribute("data-filter-boundary"));

        expect(boundaryIndex).toBe(2);
      });

      test("フォーカスのある解除を押すと、条件を外したあともフォーカスを解除に残すこと", () => {
        const clearButton = within(panel).getByRole("button", { name: "解除" });
        clearButton.focus();

        fireEvent.click(clearButton);

        expect(document.activeElement).toBe(clearButton);
        expect(clearButton.getAttribute("aria-disabled")).toBe("true");
        expect(clearButton.hasAttribute("disabled")).toBe(false);
      });

      test("解除を押すと、条件を外して番号の順に戻すこと", () => {
        fireEvent.click(within(panel).getByRole("button", { name: "解除" }));
        const order = listSquareOrder("レベル 3の問題");
        const menuButton = getMenuButton();

        expect(order).toEqual(["No.0005", "No.0006", "No.0007", "No.0008"]);
        expect(menuButton.getAttribute("aria-label")).toBe("メニュー");
      });

      test("当たらなかったマスも選べ、遊ぶでその問題を始められること", () => {
        fireEvent.click(getSquare("レベル 3の問題", "No.0007"));
        play();
        const startedProblemIds = onPlayProblem.mock.calls.map(
          ([problem]) => problem.problemId,
        );

        expect(startedProblemIds).toEqual(["p-c"]);
      });

      test("レベルを切り替えると、条件を外すこと", () => {
        chooseLevel("レベル 1");
        const menuButton = getMenuButton();
        const order = listSquareOrder("レベル 1の問題");

        expect(menuButton.getAttribute("aria-label")).toBe("メニュー");
        expect(order).toEqual(["No.0001", "No.0002", "No.0003"]);
      });
    });

    describe("問題の特徴で絞った場合", () => {
      beforeEach(() => {
        chooseFilterOption(panel, "初期数字", "24個");
      });

      test("その特徴の問題を前に並べること", () => {
        const order = listSquareOrder("レベル 3の問題");

        expect(order).toEqual([
          "No.0005",
          "No.0007",
          "No.0006 条件外",
          "No.0008 条件外",
        ]);
      });
    });

    describe("成績で絞った場合", () => {
      beforeEach(() => {
        chooseFilterOption(panel, "ミス", "ミスなし");
      });

      test("その成績で解いた問題だけを前に並べ、挑戦中と未挑戦を当てないこと", () => {
        const order = listSquareOrder("レベル 3の問題");

        expect(order).toEqual([
          "No.0005",
          "No.0006 条件外",
          "No.0007 条件外",
          "No.0008 条件外",
        ]);
      });
    });

    describe("状態と問題の特徴を組み合わせた場合", () => {
      beforeEach(() => {
        chooseFilterOption(panel, "状態", "great");
        chooseFilterOption(panel, "状態", "挑戦中");
        chooseFilterOption(panel, "初期数字", "25個");
      });

      test("種類の中はどれかに、種類をまたいではすべてに当たる問題だけを前に並べること", () => {
        const order = listSquareOrder("レベル 3の問題");

        expect(order).toEqual([
          "No.0006",
          "No.0005 条件外",
          "No.0007 条件外",
          "No.0008 条件外",
        ]);
      });
    });

    describe("選んでいる選択肢に当たる問題が、ほかの種類の条件で無くなった場合", () => {
      beforeEach(() => {
        chooseFilterOption(panel, "状態", "great");
        chooseFilterOption(panel, "状態", "挑戦中");
        chooseFilterOption(panel, "初期数字", "24個");
      });

      test("選んでいる選択肢は、当たる数が0でも押せて、押すと外せること", () => {
        const option = getFilterOption(panel, "状態", "挑戦中");
        const nameBefore = option.getAttribute("aria-label");
        const disabledBefore = option.hasAttribute("disabled");

        fireEvent.click(option);

        expect(nameBefore).toBe("挑戦中、0問");
        expect(disabledBefore).toBe(false);
        expect(option.getAttribute("aria-pressed")).toBe("false");
        expect(option.hasAttribute("disabled")).toBe(true);
      });

      test("フォーカスのある選択肢を外して0問になっても、フォーカスを残して押せないことを示し、離れてから押せなくすること", () => {
        const option = getFilterOption(panel, "状態", "挑戦中");
        option.focus();

        fireEvent.click(option);
        const focusedAfterPress = document.activeElement;
        const disabledWhileFocused = option.hasAttribute("disabled");
        fireEvent.click(option);
        const pressedAfterSecondPress = option.getAttribute("aria-pressed");
        act(() => {
          option.blur();
        });

        expect(focusedAfterPress).toBe(option);
        expect(disabledWhileFocused).toBe(false);
        expect(option.getAttribute("aria-disabled")).toBe("true");
        expect(pressedAfterSecondPress).toBe("false");
        expect(option.hasAttribute("disabled")).toBe(true);
      });
    });

    describe("当たる問題が無い場合", () => {
      beforeEach(() => {
        chooseFilterOption(panel, "状態", "great");
        chooseFilterOption(panel, "状態", "挑戦中");
        chooseFilterOption(panel, "初期数字", "24個");
        chooseFilterOption(panel, "状態", "great");
      });

      test("当たる問題が無いことを示し、全問を条件外として番号の順に並べること", () => {
        const notice = within(getSheet("レベル 3の問題")).getByText(
          "条件に当たる問題はありません",
        );
        const order = listSquareOrder("レベル 3の問題");

        expect(notice).toBeTruthy();
        expect(order).toEqual([
          "No.0005 条件外",
          "No.0006 条件外",
          "No.0007 条件外",
          "No.0008 条件外",
        ]);
        expect(getShownMatchedCount()).toBe("該当 0問");
      });
    });
  });

  describe("成績の軸をまたいで絞った場合", () => {
    const performanceProblems: ZukanProblem[] = [
      ["p-x", 5, 0, 20],
      ["p-y", 6, 2, 20],
      ["p-z", 7, 0, 23],
    ].map(([problemId, number, fewestMistakes, completionMoveCount]) => ({
      kind: "solved",
      number: Number(number),
      difficulty: "3",
      problemId: String(problemId),
      bestScore: 90,
      fastestElapsedMs: 60_000,
      fewestMoves: {
        completionMoveCount: Number(completionMoveCount),
        optimalMoveCount: 20,
      },
      fewestMistakes: Number(fewestMistakes),
      firstClearedAt: 0,
    }));

    beforeEach(async () => {
      renderScreen({
        ...zukan,
        sections: zukan.sections.map((section) =>
          section.difficulty === "3"
            ? createSection("3", performanceProblems)
            : section,
        ),
      });
      openFromMenu(/^絞り込み/);
      const panel = await screen.findByRole("dialog", { name: "絞り込み" });
      chooseFilterOption(panel, "ミス", "ミスなし");
      chooseFilterOption(panel, "手数", "最短より多い");
    });

    test("ミスと手数の両方に当たる問題だけを前に並べること", () => {
      const order = listSquareOrder("レベル 3の問題");

      expect(order).toEqual(["No.0007", "No.0005 条件外", "No.0006 条件外"]);
    });
  });

  describe("条件をかけたあと、選ぶ前に最初に開くレベルが変わった場合", () => {
    beforeEach(async () => {
      const { rerender } = renderScreen({
        ...zukan,
        latestPlayedDifficulty: "1",
      });
      openFromMenu(/^絞り込み/);
      const panel = await screen.findByRole("dialog", { name: "絞り込み" });
      chooseFilterOption(panel, "状態", "未挑戦");
      rerender(createScreen());
    });

    test("前のレベルにかけた条件を、新しく開いたレベルにかけないこと", () => {
      const sheetNames = getShownSheetNames();
      const order = listSquareOrder("レベル 3の問題");
      const menuButton = getMenuButton();

      expect(sheetNames).toEqual(["レベル 3の問題"]);
      expect(order).toEqual(["No.0005", "No.0006", "No.0007", "No.0008"]);
      expect(menuButton.getAttribute("aria-label")).toBe("メニュー");
      expect(getShownMatchedCount()).toBeNull();
    });
  });

  describe("前回図鑑を見たときから変化がある場合", () => {
    const levelOneSolvedProblem: ZukanProblem = {
      kind: "solved",
      number: 1,
      difficulty: "1",
      problemId: "p-1-0",
      bestScore: 85,
      fastestElapsedMs: 120_000,
      fewestMoves: null,
      fewestMistakes: 1,
      firstClearedAt: new Date(2026, 9, 31, 18).getTime(),
    };
    const changedZukan: GameZukan = {
      ...zukan,
      sections: zukan.sections.map((section) =>
        section.difficulty === "1"
          ? createSection("1", [
              levelOneSolvedProblem,
              ...levelOneProblems.slice(1),
            ])
          : section,
      ),
      solvedCount: 3,
    };
    const changes: ZukanChanges = {
      byDifficulty: {
        "1": new Map([
          ["p-1-0", { kind: "newly-solved", previousStatus: "attempted" }],
        ]),
        "3": new Map([
          ["p-a", { kind: "raised", previousStatus: "good" }],
          ["p-c", { kind: "newly-solved", previousStatus: "untouched" }],
        ]),
      },
    };

    function getChangedSquareNames(sheetName: string): (string | null)[] {
      return within(getSheet(sheetName))
        .getAllByRole("button")
        .map((square) => square.getAttribute("aria-label"))
        .filter((name) => name?.includes("前回から"));
    }

    function getChangeStages(sheetName: string): (string | null)[] {
      return within(getSheet(sheetName))
        .getAllByRole("button")
        .map((square) => square.getAttribute("data-change-stage"));
    }

    function getMarkedTabNames(): (string | undefined)[] {
      return within(screen.getByRole("tablist", { name: "レベル" }))
        .getAllByRole("tab")
        .map(readLevelCardName)
        .filter((name) => name?.includes("前回から変化あり"))
        .map((name) => name?.split("、")[0]);
    }

    function getTabCounts(): (string | undefined)[] {
      return within(screen.getByRole("tablist", { name: "レベル" }))
        .getAllByRole("tab")
        .map(readLevelCardCount);
    }

    function sumTabSolvedCounts(): number {
      return getTabCounts().reduce(
        (total, count) => total + Number(count?.split(" / ")[0]),
        0,
      );
    }

    function getSolvedCountText(): string | null {
      return screen.getByText(/^解いた問題 \d+ \/ 1200$/).textContent;
    }

    function getShownSolvedCount(): number {
      return Number(getSolvedCountText()?.match(/(\d+) \//)?.[1]);
    }

    /** 押していく途中の姿も描かれるよう、時刻を少しずつ進める。Animation の終わりもこの時刻で来る。 */
    async function advanceStamps(durationMs: number) {
      for (let elapsedMs = 0; elapsedMs < durationMs; elapsedMs += 20) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(20);
        });
      }
    }

    async function finishStamps() {
      await advanceStamps(2600);
    }

    function tap(target: Element, { x, y }: { x: number; y: number }) {
      fireEvent.pointerDown(target, {
        pointerId: 1,
        button: 0,
        ctrlKey: false,
        clientX: x,
        clientY: y,
      });
      fireEvent.pointerUp(target, { pointerId: 1, clientX: x, clientY: y });
    }

    let animate: ReturnType<typeof vi.fn>;

    /** 変化したマスの押す姿を動かした数。 */
    function countStampFaceAnimations(): number {
      return animate.mock.contexts.filter(
        (element) =>
          element instanceof Element &&
          element.getAttribute("data-stamp-part") === "face",
      ).length;
    }

    /** 押していく演出が台紙の外に重ねて描く効果の層。 */
    function queryStampEffectLayers(): NodeListOf<Element> {
      return document.querySelectorAll("[data-zukan-stamp-effects]");
    }

    let reducedMotionListeners: Set<() => void>;
    let prefersReduced: boolean;
    const SCROLLER_WIDTH_PX = 320;
    const SCROLLER_HEIGHT_PX = 600;
    const SQUARE_TOP_PX = 100;
    const SQUARE_SIZE_PX = 28;

    /** 渡された長さが経つと終わる Animation を作る。取り消すと終わらない。 */
    function createTimedAnimation(
      options: number | KeyframeAnimationOptions | undefined,
    ): Animation {
      const durationMs =
        typeof options === "number" ? options : Number(options?.duration ?? 0);
      let timer = 0;
      let rejectFinished: (reason: unknown) => void = () => {};
      const animation = {
        finished: new Promise<Animation>((resolve, reject) => {
          rejectFinished = reject;
          timer = window.setTimeout(
            () => resolve(animation as unknown as Animation),
            durationMs,
          );
        }),
        cancel: vi.fn(() => {
          window.clearTimeout(timer);
          rejectFinished(new DOMException("", "AbortError"));
        }),
      };
      animation.finished.catch(() => {});
      return animation as unknown as Animation;
    }

    beforeEach(() => {
      vi.useFakeTimers();
      prefersReduced = false;
      reducedMotionListeners = new Set();
      vi.stubGlobal(
        "matchMedia",
        vi.fn(
          () =>
            ({
              get matches() {
                return prefersReduced;
              },
              addEventListener: (_: string, listener: () => void) =>
                reducedMotionListeners.add(listener),
              removeEventListener: (_: string, listener: () => void) =>
                reducedMotionListeners.delete(listener),
            }) as unknown as MediaQueryList,
        ),
      );
      animate = vi.fn((_: Keyframe[], options?: KeyframeAnimationOptions) =>
        createTimedAnimation(options),
      );
      // 押す姿の影と前の色の面は SVG の要素なので、HTML の要素に限らず動きを差し替える。
      Element.prototype.animate = animate as unknown as Element["animate"];
      // jsdom はレイアウトしないので、台紙のスクロール領域に高さを持たせ、マスをその見える範囲の中に置く。
      // 見えていないマスは押さずに着いたものとし、見えるまで台紙を寄せて待つため。
      vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(
        SCROLLER_HEIGHT_PX,
      );
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
        function measure(this: Element) {
          return this.hasAttribute("data-index")
            ? new DOMRect(0, SQUARE_TOP_PX, SQUARE_SIZE_PX, SQUARE_SIZE_PX)
            : new DOMRect(0, 0, SCROLLER_WIDTH_PX, SCROLLER_HEIGHT_PX);
        },
      );
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
      Reflect.deleteProperty(Element.prototype, "animate");
    });

    describe("動きを減らさない設定の場合", () => {
      beforeEach(() => {
        renderScreen(changedZukan, changes);
      });

      describe("開いた直後", () => {
        test("変化したマスを、押す前の姿で描くこと", () => {
          const stages = getChangeStages("レベル 3の問題");

          expect(stages).toEqual(["waiting", null, "waiting", null]);
        });

        test("開いているレベルの状態ごとの数とレベルの数を前回の数から始め、画面全体の解いた数をレベルの数の合計にすること", () => {
          const levelCounts = getStatusCountNames();
          const tabCounts = getTabCounts();
          const solvedCount = getSolvedCountText();

          expect(levelCounts).toEqual([
            "perfect 0問",
            "great 0問",
            "good 1問",
            "clear 0問",
            "挑戦中 1問",
            "未挑戦 2問",
          ]);
          expect(tabCounts).toEqual([
            "0 / 3",
            "0 / 1",
            "1 / 4",
            "0 / 1",
            "0 / 1",
          ]);
          expect(solvedCount).toBe("解いた問題 1 / 1200");
        });

        test("段階が上がったマスにだけ、押す姿に前の段階の色を重ねておくこと", () => {
          const squaresWithPrevious = within(getSheet("レベル 3の問題"))
            .getAllByRole("button")
            .filter((square) =>
              square.querySelector('[data-stamp-part="previous"]'),
            )
            .map((square) => square.getAttribute("aria-label")?.split(" ")[0]);

          expect(squaresWithPrevious).toEqual(["No.0005"]);
        });

        test("マスの読み上げ名は、変化とともに今の状態を示すこと", () => {
          const names = getChangedSquareNames("レベル 3の問題");

          expect(names).toEqual([
            "No.0005 レベル 3 最高スコア92点 前回から段階が上がった",
            "No.0007 レベル 3 最高スコア70点 前回から新しく解いた",
          ]);
        });

        test("開いていないレベルのうち、変化のあるレベルにだけ印を付けること", () => {
          const markedTabs = getMarkedTabNames();

          expect(markedTabs).toEqual(["レベル 1"]);
        });

        test("まだ変化を見せ終えたと知らせないこと", () => {
          const shownDifficulties = onLevelChangesShown.mock.calls;

          expect(shownDifficulties).toEqual([]);
        });
      });

      describe("最初のマスを押し終え、次のマスを押している場合", () => {
        beforeEach(async () => {
          await advanceStamps(520);
        });

        test("押し終えたマスを今の姿で、押しているマスを押す姿で描くこと", () => {
          const stages = getChangeStages("レベル 3の問題");

          expect(stages).toEqual(["landed", null, "stamping", null]);
        });

        test("マスに着いた変化の分だけ状態ごとの数を数え、押している新しく解いたマスを未挑戦の数と解いた数に残すこと", () => {
          const levelCounts = getStatusCountNames();
          const solvedCount = getSolvedCountText();

          expect(levelCounts).toEqual([
            "perfect 0問",
            "great 1問",
            "good 0問",
            "clear 0問",
            "挑戦中 1問",
            "未挑戦 2問",
          ]);
          expect(solvedCount).toBe("解いた問題 1 / 1200");
        });
      });

      describe("押し終えた場合", () => {
        beforeEach(async () => {
          await finishStamps();
        });

        test("変化したマスごとに、押す姿を落として戻す2つの動きをしたこと", () => {
          const faceAnimationCount = countStampFaceAnimations();

          expect(faceAnimationCount).toBe(4);
        });

        test("押していく間に重ねて描いた効果を片付けたこと", () => {
          const effectLayers = queryStampEffectLayers();

          expect(effectLayers).toHaveLength(0);
        });

        test("マスを今の姿で描き、変化の段階を残さないこと", () => {
          const stages = getChangeStages("レベル 3の問題");

          expect(stages).toEqual([null, null, null, null]);
        });

        test("開いているレベルの数を今の数まで数え上げて未挑戦の数を減らし、まだ開いていないレベルは前回の数のまま印を残すこと", () => {
          const levelCounts = getStatusCountNames();
          const tabCounts = getTabCounts();
          const markedTabs = getMarkedTabNames();

          expect(levelCounts).toEqual([
            "perfect 0問",
            "great 1問",
            "good 0問",
            "clear 1問",
            "挑戦中 1問",
            "未挑戦 1問",
          ]);
          expect(tabCounts).toEqual([
            "0 / 3",
            "0 / 1",
            "2 / 4",
            "0 / 1",
            "0 / 1",
          ]);
          expect(markedTabs).toEqual(["レベル 1"]);
        });

        test("画面全体の解いた数を、レベルの数の合計に合わせること", () => {
          const solvedCount = getShownSolvedCount();

          expect(solvedCount).toBe(sumTabSolvedCounts());
        });

        test("開いているレベルの変化だけを見せ終えたと知らせること", () => {
          const shownDifficulties = onLevelChangesShown.mock.calls;

          expect(shownDifficulties).toEqual([["3"]]);
        });

        test("マスを選べること", () => {
          selectSquare("レベル 3の問題", "No.0007");
          const selectedNumber = readStageNumber();

          expect(selectedNumber).toBe("No.0007");
        });
      });

      describe("押している途中でタップした場合", () => {
        beforeEach(async () => {
          await advanceStamps(400);
          tap(document.body, { x: 10, y: 10 });
        });

        test("重ねて描いていた効果を片付けること", () => {
          const effectLayers = queryStampEffectLayers();

          expect(effectLayers).toHaveLength(0);
        });

        test("最後の姿まで飛ばし、見せ終えたと知らせること", () => {
          const stages = getChangeStages("レベル 3の問題");
          const tabCounts = getTabCounts();

          expect(stages).toEqual([null, null, null, null]);
          expect(tabCounts).toEqual([
            "0 / 3",
            "0 / 1",
            "2 / 4",
            "0 / 1",
            "0 / 1",
          ]);
          expect(onLevelChangesShown.mock.calls).toEqual([["3"]]);
        });

        test("飛ばしたタップに続くクリックではマスを選ばず、次のタップから選べること", () => {
          selectSquare("レベル 3の問題", "No.0007");
          const selectedAfterSkip = readStageNumber();
          fireEvent.pointerDown(getSquare("レベル 3の問題", "No.0007"), {
            pointerId: 1,
          });
          selectSquare("レベル 3の問題", "No.0007");
          const selectedAfterTap = readStageNumber();

          expect(selectedAfterSkip).toBe("No.0005");
          expect(selectedAfterTap).toBe("No.0007");
        });
      });

      describe("押している途中で別の問題をタップした場合", () => {
        beforeEach(async () => {
          await advanceStamps(400);
        });

        test("1回のタップで、最後の姿まで飛ばして、ゲームが選んだ別の問題に替えること", () => {
          const button = getShuffleButton();

          tap(button, { x: 10, y: 10 });
          fireEvent.click(button);
          const stages = getChangeStages("レベル 3の問題");

          expect(stages).toEqual([null, null, null, null]);
          expect(readStageNumber()).toBe("No.0006");
        });
      });

      describe("押している途中で遊ぶをタップした場合", () => {
        beforeEach(async () => {
          await advanceStamps(400);
        });

        test("最後の姿まで飛ばすだけで、プレイを始めないこと", async () => {
          const button = getPlayButton();

          tap(button, { x: 10, y: 10 });
          fireEvent.click(button);
          await advanceStamps(400);
          const stages = getChangeStages("レベル 3の問題");

          expect(stages).toEqual([null, null, null, null]);
          expect(onPlayProblem).not.toHaveBeenCalled();
        });
      });

      describe("押している途中で、指の下にあるマスを押さえた場合", () => {
        beforeEach(async () => {
          await advanceStamps(400);
          document.elementFromPoint = () =>
            getSquare("レベル 3の問題", "No.0008");
        });

        afterEach(() => {
          Reflect.deleteProperty(document, "elementFromPoint");
        });

        test("最後の姿まで飛ばすだけで、そのマスを選ばないこと", () => {
          const square = getSquare("レベル 3の問題", "No.0008");

          tap(square, { x: 10, y: 10 });
          fireEvent.click(square);
          const stages = getChangeStages("レベル 3の問題");

          expect(stages).toEqual([null, null, null, null]);
          expect(readStageNumber()).toBe("No.0005");
        });
      });

      describe("押している途中で台紙をドラッグした場合", () => {
        beforeEach(async () => {
          await advanceStamps(400);
        });

        test("押し離すまでに大きく動かしたときは飛ばさないこと", () => {
          const sheet = getSheet("レベル 3の問題");
          fireEvent.pointerDown(sheet, {
            pointerId: 1,
            clientX: 10,
            clientY: 200,
          });
          fireEvent.pointerUp(sheet, {
            pointerId: 1,
            clientX: 12,
            clientY: 120,
          });
          const stages = getChangeStages("レベル 3の問題");

          expect(stages).not.toEqual([null, null, null, null]);
          expect(onLevelChangesShown).not.toHaveBeenCalled();
        });

        test("ブラウザがスクロールに切り替えたときは飛ばさないこと", () => {
          const sheet = getSheet("レベル 3の問題");
          fireEvent.pointerDown(sheet, {
            pointerId: 1,
            clientX: 10,
            clientY: 200,
          });
          fireEvent.pointerCancel(sheet, { pointerId: 1 });
          fireEvent.pointerUp(sheet, {
            pointerId: 1,
            clientX: 10,
            clientY: 200,
          });
          const stages = getChangeStages("レベル 3の問題");

          expect(stages).not.toEqual([null, null, null, null]);
        });
      });

      describe("押している途中でキーを押した場合", () => {
        beforeEach(async () => {
          await advanceStamps(400);
        });

        test("最後の姿まで飛ばすこと", () => {
          fireEvent.keyDown(document.body, { key: "Escape" });
          const stages = getChangeStages("レベル 3の問題");

          expect(stages).toEqual([null, null, null, null]);
        });
      });

      describe("押している途中で絞り込みを開いた場合", () => {
        beforeEach(async () => {
          await advanceStamps(400);
        });

        test("メニューのボタンを1回タップすると、最後の姿まで飛ばしてメニューを開くこと", () => {
          tap(getMenuButton(), { x: 10, y: 10 });
          const menu = screen.queryByRole("menu");
          // 開いたメニューはほかの要素を読み上げから外すので、閉じてから台紙を確かめる。
          fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
          const stages = getChangeStages("レベル 3の問題");

          expect(menu).not.toBeNull();
          expect(stages).toEqual([null, null, null, null]);
          expect(onLevelChangesShown.mock.calls).toEqual([["3"]]);
        });

        test("メニューから絞り込みを開くと、最後の姿まで飛ばし、見せ終えたと知らせること", async () => {
          openFromMenu(/^絞り込み/);
          // メニューが閉じ切ってから絞り込みを開くので、閉じるのを待つ。
          await advanceStamps(20);
          const panel = screen.queryByRole("dialog", { name: "絞り込み" });
          const stages = getChangeStages("レベル 3の問題");
          const shownDifficulties = onLevelChangesShown.mock.calls;

          expect(panel).not.toBeNull();
          expect(stages).toEqual([null, null, null, null]);
          expect(shownDifficulties).toEqual([["3"]]);
        });
      });

      describe("押している途中で画面を離れた場合", () => {
        let addedListeners: unknown[][];
        let removedListeners: unknown[][];

        beforeEach(async () => {
          await advanceStamps(400);
          addedListeners = [];
          removedListeners = [];
          vi.spyOn(document, "removeEventListener").mockImplementation(
            function track(this: Document, ...args) {
              removedListeners.push(args);
              return EventTarget.prototype.removeEventListener.apply(
                this,
                args,
              );
            },
          );
          vi.spyOn(document, "addEventListener").mockImplementation(
            function track(this: Document, ...args) {
              addedListeners.push(args);
              return EventTarget.prototype.addEventListener.apply(this, args);
            },
          );
        });

        afterEach(() => {
          vi.restoreAllMocks();
        });

        test("押していく途中の動きと待ちと、飛ばすための操作の受け付けをやめ、見せ終えたと知らせないこと", async () => {
          cleanup();
          const animatedCountAfterUnmount = animate.mock.calls.length;
          await vi.advanceTimersByTimeAsync(2000);
          const removedTypes = removedListeners.map(([type]) => type);

          expect(removedTypes).toEqual(
            expect.arrayContaining([
              "pointerdown",
              "pointerup",
              "pointercancel",
              "wheel",
              "keydown",
            ]),
          );
          expect(addedListeners).toEqual([]);
          expect(animate.mock.calls.length).toBe(animatedCountAfterUnmount);
          expect(onLevelChangesShown).not.toHaveBeenCalled();
        });

        test("重ねて描いていた効果を片付けること", () => {
          cleanup();
          const effectLayers = queryStampEffectLayers();

          expect(effectLayers).toHaveLength(0);
        });
      });

      describe("押している途中で、変化をまだ見せていないレベルへ切り替えた場合", () => {
        beforeEach(async () => {
          await advanceStamps(400);
          animate.mockClear();
          chooseLevel("レベル 1");
        });

        test("切り替える前のレベルの変化を見せ終えたと知らせること", () => {
          const shownDifficulties = onLevelChangesShown.mock.calls;

          expect(shownDifficulties).toEqual([["3"]]);
        });

        test("そのレベルの台紙と数を前回の姿から始め、前回挑戦中だったマスを挑戦中として数えること", () => {
          const stages = getChangeStages("レベル 1の問題");
          const levelCounts = getStatusCountNames();
          const tabCounts = getTabCounts();
          const solvedCount = getShownSolvedCount();

          expect(stages).toEqual(["waiting", null, null]);
          expect(levelCounts).toEqual([
            "perfect 0問",
            "great 0問",
            "good 0問",
            "clear 0問",
            "挑戦中 1問",
            "未挑戦 2問",
          ]);
          expect(tabCounts).toEqual([
            "0 / 3",
            "0 / 1",
            "2 / 4",
            "0 / 1",
            "0 / 1",
          ]);
          expect(solvedCount).toBe(sumTabSolvedCounts());
        });

        test("そのレベルの変化を押して数え上げて挑戦中の数を減らし、印を外して見せ終えたと知らせること", async () => {
          await finishStamps();
          const levelCounts = getStatusCountNames();
          const tabCounts = getTabCounts();
          const markedTabs = getMarkedTabNames();

          expect(countStampFaceAnimations()).toBe(2);
          expect(levelCounts).toEqual([
            "perfect 0問",
            "great 0問",
            "good 1問",
            "clear 0問",
            "挑戦中 0問",
            "未挑戦 2問",
          ]);
          expect(tabCounts).toEqual([
            "1 / 3",
            "0 / 1",
            "2 / 4",
            "0 / 1",
            "0 / 1",
          ]);
          expect(markedTabs).toEqual([]);
          expect(getShownSolvedCount()).toBe(3);
          expect(onLevelChangesShown.mock.calls).toEqual([["3"], ["1"]]);
        });

        test("見せ終えたレベルへ戻っても、変化を見せ直さないこと", async () => {
          await finishStamps();
          chooseLevel("レベル 3");
          const stages = getChangeStages("レベル 3の問題");

          expect(stages).toEqual([null, null, null, null]);
        });
      });
    });

    describe("ページが裏にある間に開いた場合", () => {
      let visibilityState: DocumentVisibilityState;

      beforeEach(async () => {
        visibilityState = "hidden";
        vi.spyOn(document, "visibilityState", "get").mockImplementation(
          () => visibilityState,
        );
        renderScreen(changedZukan, changes);
        await advanceStamps(2000);
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      test("押し始めず、見せ終えたとも知らせないこと", () => {
        const stages = getChangeStages("レベル 3の問題");

        expect(stages).toEqual(["waiting", null, "waiting", null]);
        expect(animate).not.toHaveBeenCalled();
        expect(onLevelChangesShown).not.toHaveBeenCalled();
      });

      test("ページが見えてから押し始め、見せ終えたと知らせること", async () => {
        visibilityState = "visible";
        act(() => {
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await finishStamps();
        const stages = getChangeStages("レベル 3の問題");

        expect(animate).toHaveBeenCalled();
        expect(stages).toEqual([null, null, null, null]);
        expect(onLevelChangesShown.mock.calls).toEqual([["3"]]);
      });
    });

    describe("変化の無い図鑑で、盤面を広げて動かせる環境の場合", () => {
      const { SCENE_FADE_MS } = playEntryPrivate;

      /** ゲームのホームの外の body の直下に置いた、動かす写しの中に描いた盤面の文字。 */
      function listCopiedBoards(): (string | null)[] {
        return [...document.body.children]
          .filter((child) => !child.contains(getGameHeading()))
          .flatMap((child) => [
            ...child.querySelectorAll("[data-play-entry-board]"),
          ])
          .map((board) => board.textContent);
      }

      beforeEach(() => {
        renderScreen();
      });

      afterEach(async () => {
        // 広げた盤面の写しを body に残さないよう、動きを終えさせる。
        await advanceStamps(1000);
      });

      test("遊ぶを押すと、盤面が広がるまでプレイを始めず、広がったらこれから遊ぶ問題で始めること", async () => {
        play();
        await advanceStamps(SCENE_FADE_MS - 20);
        const startedBeforeArrive = onPlayProblem.mock.calls.length;
        await advanceStamps(20);

        expect(startedBeforeArrive).toBe(0);
        expect(onPlayProblem.mock.calls).toEqual([[levelThreeProblems[0]]]);
      });

      test("遊ぶを押すと、これから遊ぶ問題の盤面を広げる写しを画面に重ねること", () => {
        play();
        const boards = listCopiedBoards();

        expect(boards).toEqual(["p-aの盤面"]);
      });

      test("広がり終えたら、広げた写しを画面に残さないこと", async () => {
        play();
        await advanceStamps(1000);
        const boards = listCopiedBoards();

        expect(boards).toEqual([]);
      });

      describe("別の問題に替えた直後の場合", () => {
        beforeEach(() => {
          shuffle();
        });

        test("遊ぶを押すと、広げる写しの中に、替えた問題の盤面だけを描くこと", () => {
          play();
          const boards = listCopiedBoards();

          expect(boards).toEqual(["p-bの盤面"]);
        });
      });

      describe("遊ぶを押して、盤面が広がっている場合", () => {
        beforeEach(async () => {
          play();
          await advanceStamps(SCENE_FADE_MS - 20);
        });

        test("遊ぶを押し直しても、プレイを二重に始めないこと", async () => {
          play();
          await advanceStamps(400);

          expect(onPlayProblem).toHaveBeenCalledTimes(1);
        });

        test("別の問題を押しても、ゲームに選ばせ直さず、始める問題を替えないこと", async () => {
          shuffle();
          await advanceStamps(400);

          expect(selectRandomProblemId).toHaveBeenCalledTimes(1);
          expect(onPlayProblem.mock.calls).toEqual([[levelThreeProblems[0]]]);
        });
      });
    });

    describe("盤面を広げて動かせる環境で、盤面をまだ描けていない場合", () => {
      /** 問題集を読み込んでいる途中のように、盤面の目印を持たない姿を描く。 */
      function renderLoadingProblemPreview({ problemId }: ZukanProblem) {
        return <p>{`${problemId}を読み込み中`}</p>;
      }

      beforeEach(() => {
        renderProblemPreview.mockImplementation(renderLoadingProblemPreview);
        renderScreen();
      });

      afterEach(() => {
        renderProblemPreview.mockImplementation(renderMarkedProblemPreview);
      });

      test("遊ぶを押すと、盤面を広げずにすぐこれから遊ぶ問題を始めること", () => {
        play();
        const copies = screen
          .queryAllByText("p-aを読み込み中")
          .filter((board) => !getStage().contains(board));

        expect(onPlayProblem.mock.calls).toEqual([[levelThreeProblems[0]]]);
        expect(copies).toEqual([]);
      });

      describe("遊ぶを押したあと、プレイ画面へ移らずに残った場合", () => {
        beforeEach(() => {
          play();
        });

        test("遊ぶを押し直すと、もう一度始めること", () => {
          play();

          expect(onPlayProblem.mock.calls).toEqual([
            [levelThreeProblems[0]],
            [levelThreeProblems[0]],
          ]);
        });
      });
    });

    describe("変化したマスが13個以上ある場合", () => {
      const manyProblems = createUntouchedProblems("2", 4, 15).map(
        (problem): ZukanProblem => ({
          kind: "solved",
          number: problem.number,
          difficulty: "2",
          problemId: problem.problemId,
          bestScore: 60,
          fastestElapsedMs: 60_000,
          fewestMoves: null,
          fewestMistakes: null,
          firstClearedAt: 0,
        }),
      );
      const manyZukan: GameZukan = {
        ...zukan,
        sections: zukan.sections.map((section) =>
          section.difficulty === "2"
            ? createSection("2", manyProblems)
            : section,
        ),
        latestPlayedDifficulty: "2",
      };
      const manyChanges: ZukanChanges = {
        byDifficulty: {
          "2": new Map(
            manyProblems.map(({ problemId }) => [
              problemId,
              { kind: "newly-solved", previousStatus: "untouched" },
            ]),
          ),
        },
      };
      type CountSample = { untouched: number; solved: number; total: number };

      /** 押していく途中に数を示す、見出し・レベル・状態ごとの数の領域。 */
      type CountRegions = {
        heading: HTMLElement;
        tabList: HTMLElement;
        statusCounts: HTMLElement;
      };

      /**
       * 押し終えるまで20msごとに読んだ数。テストは読むだけなので、押していく描画をテストごとに繰り返さず、最初に読んだものを共有する。
       */
      let samples: readonly CountSample[] = [];

      /**
       * 文書全体から引き直すと1回ごとに時間がかかるので、開いたときに引いた領域の中を読む。
       * 領域が描き直しで入れ替わると数が動かなくなり、テストが失敗する。
       */
      function readCounts({
        heading,
        tabList,
        statusCounts,
      }: CountRegions): CountSample {
        const untouchedName = within(statusCounts)
          .getAllByRole("listitem")
          .map((item) => item.getAttribute("aria-label"))
          .find((name) => name?.startsWith("未挑戦"));
        const levelTwoCount = readLevelCardCount(
          within(tabList).getAllByRole("tab")[1] as HTMLElement,
        );
        const solvedCountText =
          within(heading).getByText(/^解いた問題 \d+ \/ 1200$/).textContent;
        return {
          untouched: Number(untouchedName?.match(/\d+/)?.[0]),
          solved: Number(levelTwoCount?.split(" / ")[0]),
          total: Number(solvedCountText?.match(/(\d+) \//)?.[1]),
        };
      }

      beforeEach(async () => {
        if (samples.length > 0) {
          return;
        }
        renderScreen(manyZukan, manyChanges);
        const regions: CountRegions = {
          heading: getGameHeading(),
          tabList: screen.getByRole("tablist", { name: "レベル" }),
          statusCounts: getStatusCounts(),
        };
        const readSamples: CountSample[] = [];
        for (let elapsedMs = 0; elapsedMs < 2500; elapsedMs += 20) {
          readSamples.push(readCounts(regions));
          await advanceStamps(20);
        }
        readSamples.push(readCounts(regions));
        samples = readSamples;
      });

      test("未挑戦の数を一度も増やさずに減らしていき、最後に0にすること", () => {
        const untouchedCounts = samples.map(({ untouched }) => untouched);
        const isNonIncreasing = untouchedCounts.every(
          (count, index) =>
            index === 0 || count <= (untouchedCounts[index - 1] ?? 0),
        );

        expect(untouchedCounts[0]).toBe(15);
        expect(isNonIncreasing).toBe(true);
        expect(untouchedCounts.at(-1)).toBe(0);
      });

      test("12マス目までを1つずつ数え、残りの3マスをまとめて押して最後に今の数に着くこと", () => {
        const solvedCounts = [...new Set(samples.map(({ solved }) => solved))];

        expect(solvedCounts).toEqual([
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15,
        ]);
      });

      test("画面全体の解いた数を、常にレベルの数の合計に合わせること", () => {
        const mismatches = samples.filter(
          ({ solved, total }) => total !== solved + 2,
        );

        expect(mismatches).toEqual([]);
      });
    });

    describe("動きを減らす設定の場合", () => {
      beforeEach(() => {
        prefersReduced = true;
        renderScreen(changedZukan, changes);
      });

      test("マスを動かさず、変化したマスにだけ印を載せること", () => {
        const markedSquares = within(getSheet("レベル 3の問題"))
          .getAllByRole("button")
          .filter((square) => square.querySelector("[data-change-mark]"))
          .map((square) => square.getAttribute("aria-label")?.split(" ")[0]);
        const animatedCount = animate.mock.calls.length;

        expect(markedSquares).toEqual(["No.0005", "No.0007"]);
        expect(animatedCount).toBe(0);
      });

      test("数え上げずに、画面全体の解いた数・レベルの数を今の数で示すこと", () => {
        const solvedCount = getSolvedCountText();
        const tabCounts = getTabCounts();

        expect(solvedCount).toBe("解いた問題 3 / 1200");
        expect(tabCounts).toEqual([
          "1 / 3",
          "0 / 1",
          "2 / 4",
          "0 / 1",
          "0 / 1",
        ]);
      });

      test("印を載せた台紙を見せたところで、開いているレベルの変化を見せ終えたと知らせること", () => {
        const shownDifficulties = onLevelChangesShown.mock.calls;

        expect(shownDifficulties).toEqual([["3"]]);
      });

      test("まだ見せていない変化のあるレベルに印を付けること", () => {
        const markedTabs = getMarkedTabNames();

        expect(markedTabs).toEqual(["レベル 1"]);
      });
    });

    describe("動きを減らす設定で、見せる変化のある問題を選んでおく問題として渡した場合", () => {
      beforeEach(() => {
        prefersReduced = true;
        renderScreen(changedZukan, changes, "p-c");
      });

      test("そのレベルを開いて印を載せた台紙を見せ、選んでおいた問題をこれから遊ぶ問題として示すこと", () => {
        const stages = getChangeStages("レベル 3の問題");
        const openLevel = readOpenLevel();
        const square = getSquare("レベル 3の問題", "No.0007");
        const stageNumber = readStageNumber();

        expect(stages).toEqual(["marked", null, "marked", null]);
        expect(openLevel).toBe("レベル 3");
        expect(square.getAttribute("aria-current")).toBe("true");
        expect(stageNumber).toBe("No.0007");
      });
    });

    describe("見せる変化のある問題を選んでおく問題として渡し、押している途中の場合", () => {
      beforeEach(async () => {
        renderScreen(changedZukan, changes, "p-c");
        await advanceStamps(400);
      });

      test("そのレベルを開き、押している間も、選んでおいた問題をこれから遊ぶ問題として示すこと", () => {
        const openLevel = readOpenLevel();
        const square = getSquare("レベル 3の問題", "No.0007");
        const stageNumber = readStageNumber();

        expect(openLevel).toBe("レベル 3");
        expect(square.getAttribute("aria-current")).toBe("true");
        expect(stageNumber).toBe("No.0007");
      });

      test("Escape で飛ばしても、選んでおいた問題をこれから遊ぶ問題として保つこと", () => {
        fireEvent.keyDown(document, { key: "Escape" });
        const stageNumber = readStageNumber();

        expect(stageNumber).toBe("No.0007");
      });
    });

    describe("押している途中で動きを減らす設定に変えた場合", () => {
      beforeEach(async () => {
        renderScreen(changedZukan, changes);
        await advanceStamps(400);
        prefersReduced = true;
        act(() => {
          for (const listener of reducedMotionListeners) {
            listener();
          }
        });
      });

      test("押すのをやめて今の姿に印を載せ、見せ終えたと知らせること", async () => {
        const animatedCount = animate.mock.calls.length;
        await advanceStamps(1000);
        const stages = getChangeStages("レベル 3の問題");

        expect(stages).toEqual(["marked", null, "marked", null]);
        expect(animate.mock.calls.length).toBe(animatedCount);
        expect(onLevelChangesShown.mock.calls).toEqual([["3"]]);
      });
    });
  });

  describe("開いたあとに最後に遊んだレベルが変わった場合", () => {
    beforeEach(() => {
      const { rerender } = renderScreen();
      rerender(createScreen({ ...zukan, latestPlayedDifficulty: "5" }));
    });

    test("新しく開いたレベルの台紙を示し、そのレベルからゲームが選んだ問題をこれから遊ぶ問題にすること", () => {
      const openLevel = readOpenLevel();
      const stageNumber = readStageNumber();

      expect(openLevel).toBe("レベル 5");
      expect(selectRandomProblemId.mock.calls).toEqual([["3"], ["5"]]);
      expect(stageNumber).toBe("No.0010");
    });
  });

  describe("そのゲームを遊んだことが無い場合", () => {
    beforeEach(() => {
      renderScreen({ ...zukan, latestPlayedDifficulty: null });
    });

    test("最も低いレベルを選び、そのレベルの台紙を示すこと", () => {
      const openLevel = readOpenLevel();
      const sheetNames = getShownSheetNames();

      expect(openLevel).toBe("レベル 1");
      expect(sheetNames).toEqual(["レベル 1の問題"]);
    });

    test("最も低いレベルに、ほかのレベルに無い印や要素を足さないこと", () => {
      const levelStructures = within(
        screen.getByRole("tablist", { name: "レベル" }),
      )
        .getAllByRole("tab")
        .map(describeElementStructure);

      expect(new Set(levelStructures).size).toBe(1);
    });

    test("遊ぶを押すと、最も低いレベルからゲームが選んだ問題を始めること", () => {
      play();

      expect(onPlayProblem.mock.calls).toEqual([[levelOneProblems[0]]]);
    });

    test("Tab でレベルに入っても、別のレベルを選ばないこと", () => {
      const tab = getLevelTab("レベル 2");

      fireEvent.focus(tab);
      const openLevel = readOpenLevel();

      expect(openLevel).toBe("レベル 1");
    });
  });

  describe("最も低いレベルに問題が無いゲームを遊んだことが無い場合", () => {
    beforeEach(() => {
      renderScreen({
        ...zukan,
        sections: zukan.sections.map((section) =>
          section.difficulty === "1" ? { ...section, problems: [] } : section,
        ),
        latestPlayedDifficulty: null,
      });
    });

    test("問題のある最も低いレベルを開くこと", () => {
      const openLevel = readOpenLevel();

      expect(openLevel).toBe("レベル 2");
    });
  });

  describe("選んでおく問題を渡した場合", () => {
    beforeEach(() => {
      renderScreen(zukan, noZukanChanges, "p-1-1");
    });

    test("その問題のレベルを、最後に遊んだレベルより優先して開くこと", () => {
      const openLevel = readOpenLevel();
      const sheetNames = getShownSheetNames();

      expect(openLevel).toBe("レベル 1");
      expect(sheetNames).toEqual(["レベル 1の問題"]);
    });

    test("ゲームに選ばせず、その問題をこれから遊ぶ問題として、そのマスと盤面で示すこと", () => {
      const square = getSquare("レベル 1の問題", "No.0002");
      const stageNumber = readStageNumber();
      const preview = within(getPreviewFrame()).getByText("p-1-1の盤面");

      expect(selectRandomProblemId).not.toHaveBeenCalled();
      expect(square.getAttribute("aria-current")).toBe("true");
      expect(stageNumber).toBe("No.0002");
      expect(preview).toBeTruthy();
    });

    test("遊ぶを押すと、選んでおいた問題を始めること", () => {
      play();

      expect(onPlayProblem.mock.calls).toEqual([[levelOneProblems[1]]]);
    });

    test("別の問題を押すと、選んでおいた問題を除いてゲームに選ばせること", () => {
      shuffle();

      expect(selectRandomProblemId.mock.calls).toEqual([["1", "p-1-1"]]);
      expect(readStageNumber()).toBe("No.0001");
    });
  });

  describe("図鑑に無い問題を選んでおく問題として渡した場合", () => {
    beforeEach(() => {
      renderScreen(zukan, noZukanChanges, "unknown-problem");
    });

    test("最後に遊んだレベルを開き、そのレベルからゲームが選んだ問題をこれから遊ぶ問題にすること", () => {
      const openLevel = readOpenLevel();
      const stageNumber = readStageNumber();

      expect(openLevel).toBe("レベル 3");
      expect(selectRandomProblemId.mock.calls).toEqual([["3"]]);
      expect(stageNumber).toBe("No.0005");
    });
  });

  describe("プレイ画面から戻ってきた場合", () => {
    let animate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      // 収める動きを止めて、時点ごとに盤面と重なる要素を測れるようにする。
      animate = vi.fn(() => ({
        currentTime: 0,
        finished: new Promise(() => {}),
        cancel: vi.fn(),
        pause: vi.fn(),
        play: vi.fn(),
      }));
      Element.prototype.animate = animate as unknown as Element["animate"];
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 0, 100, 100),
      );
      // プレイ画面の盤面の位置を控えてから、プレイ画面を離れる。
      const playBoard = document.createElement("div");
      playBoard.dataset.playEntryBoard = "";
      const playFrame = document.createElement("section");
      playFrame.dataset.playFrame = "";
      playFrame.append(playBoard);
      document.body.append(playFrame);
      leavePlayBoard();
      playFrame.remove();
      renderProblemPreview.mockImplementation(({ problemId }: ZukanProblem) => (
        <p data-play-entry-board="">{`${problemId}の盤面`}</p>
      ));
    });

    afterEach(() => {
      playBoardReturnPrivate.reset();
      vi.restoreAllMocks();
      renderProblemPreview.mockReset();
      Reflect.deleteProperty(Element.prototype, "animate");
    });

    describe("選んでおく問題を渡した場合", () => {
      beforeEach(() => {
        renderScreen(zukan, noZukanChanges, "p-1-1");
      });

      test("選んだ問題の盤面の写しを画面の手前に重ね、プレイ画面で盤面があった所から収めること", () => {
        const settledBoards = animate.mock.contexts.filter(
          (element): element is HTMLElement =>
            element instanceof HTMLElement &&
            element.parentElement === document.body &&
            element.getAttribute("aria-hidden") === "true",
        );

        expect(settledBoards).toHaveLength(1);
        expect(
          within(settledBoards[0] as HTMLElement).getByText("p-1-1の盤面"),
        ).toBeTruthy();
      });

      test("写しが収まるまで、選んだ問題の盤面を見せずに置くこと", () => {
        const opacity = getPreviewFrame().style.opacity;

        expect(opacity).toBe("0");
      });
    });

    describe("選んでおく問題が無い場合", () => {
      beforeEach(() => {
        renderScreen();
      });

      test("ゲームが選んだ問題の盤面の写しを、プレイ画面で盤面があった所から収めること", () => {
        const settledBoards = animate.mock.contexts.filter(
          (element): element is HTMLElement =>
            element instanceof HTMLElement &&
            element.parentElement === document.body &&
            element.getAttribute("aria-hidden") === "true",
        );

        expect(settledBoards).toHaveLength(1);
        expect(
          within(settledBoards[0] as HTMLElement).getByText("p-aの盤面"),
        ).toBeTruthy();
      });
    });

    describe("出題できる問題が無い場合", () => {
      beforeEach(() => {
        selectRandomProblemId.mockReturnValue(null);
        renderScreen();
      });

      test("盤面を収める動きをしないこと", () => {
        const animatedCount = animate.mock.calls.length;

        expect(animatedCount).toBe(0);
      });
    });
  });
});

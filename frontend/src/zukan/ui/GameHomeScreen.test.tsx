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

import { type DifficultyLevel, difficultyLevels } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
import {
  GameHomeScreen,
  type ZukanFeatureAxis,
} from "@/zukan/ui/GameHomeScreen";
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
const onPlayRandom = vi.fn();
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
const findProblemFeatureValues = vi.fn(
  ({ problemId }: ZukanProblem) =>
    new Map([
      ["clues", { kind: "count", count: clueCounts[problemId] ?? 24 } as const],
    ]),
);

function createScreen(
  shownZukan: GameZukan = zukan,
  changes: ZukanChanges = noZukanChanges,
  initialSelectedProblemId: ProblemId | null = null,
) {
  return (
    <MemoryRouter>
      <GameHomeScreen
        gameTitle="ナンプレ"
        pictogramSvg="<svg></svg>"
        zukan={shownZukan}
        changes={changes}
        initialSelectedProblemId={initialSelectedProblemId}
        onPlayRandom={onPlayRandom}
        onPlayProblem={onPlayProblem}
        onLevelChangesShown={onLevelChangesShown}
        describeProblem={describeProblem}
        featureAxes={featureAxes}
        findProblemFeatureValues={findProblemFeatureValues}
        renderLevelPreview={(difficulty) => (
          <span data-level-preview={difficulty} />
        )}
        renderHowToPlayDialog={({ open }) =>
          open ? <p>遊び方のダイアログ</p> : null
        }
      />
    </MemoryRouter>
  );
}

function renderScreen(
  shownZukan: GameZukan = zukan,
  changes: ZukanChanges = noZukanChanges,
  initialSelectedProblemId: ProblemId | null = null,
) {
  return render(createScreen(shownZukan, changes, initialSelectedProblemId));
}

function getSheet(name: string): HTMLElement {
  return screen.getByRole("group", { name });
}

function getSquare(sheetName: string, numberLabel: string): HTMLElement {
  return within(getSheet(sheetName)).getByRole("button", {
    name: new RegExp(`^${numberLabel} `),
  });
}

function getDetail(): HTMLElement {
  return screen.getByRole("complementary", { name: "選んだ問題" });
}

/** 詳細に名前と値の組で示した、問題の特徴と成績。 */
function listDetailFacts(detail: HTMLElement) {
  return within(detail)
    .queryAllByRole("term")
    .map((term) => [term.textContent, term.nextSibling?.textContent]);
}

function queryDetail(): HTMLElement | null {
  return screen.queryByRole("complementary", { name: "選んだ問題" });
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

function getFilterButton(): HTMLElement {
  return screen.getByRole("button", { name: /^絞り込み/ });
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

function getSheetScroller(name: string): HTMLElement {
  const scroller = getSheet(name).parentElement;
  if (scroller === null) {
    throw new Error("台紙のスクロール領域が無い");
  }
  return scroller;
}

function getLevelTab(label: string): HTMLElement {
  return screen.getByRole("tab", { name: new RegExp(`^${label}`) });
}

/** 読み上げる名前と同じく、見せるだけの要素を除いたカードの文字。 */
function readLevelCardName(tab: Element): string | null {
  const shown = tab.cloneNode(true) as Element;
  for (const hidden of shown.querySelectorAll('[aria-hidden="true"]')) {
    hidden.remove();
  }
  return shown.textContent;
}

/** カードに示した「解いた数 / 全問の数」。 */
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
  return within(screen.getByRole("tabpanel"))
    .getAllByRole("group")
    .map((sheet) => sheet.getAttribute("aria-label"));
}

function getStatusCounts(): HTMLElement {
  return within(screen.getByRole("tabpanel")).getByRole("list", {
    name: "状態ごとの問題の数",
  });
}

function getStatusCountNames(): (string | null)[] {
  return within(getStatusCounts())
    .getAllByRole("listitem")
    .map((item) => item.getAttribute("aria-label"));
}

let scrollIntoView: ReturnType<typeof vi.fn>;
let scrollTo: ReturnType<typeof vi.fn>;
let resizeCallbacks: Set<ResizeObserverCallback>;

/** 見ている要素の大きさが変わったと、ResizeObserver の購読者へ知らせる。 */
function resizeObservedElements(blockSize: number) {
  const entry = {
    borderBoxSize: [{ blockSize, inlineSize: 0 }],
  } as unknown as ResizeObserverEntry;
  act(() => {
    for (const callback of resizeCallbacks) {
      callback([entry], {} as ResizeObserver);
    }
  });
}

function createResizeObserver(callback: ResizeObserverCallback) {
  return {
    observe: () => resizeCallbacks.add(callback),
    unobserve: () => resizeCallbacks.delete(callback),
    disconnect: () => resizeCallbacks.delete(callback),
  };
}

beforeEach(() => {
  scrollIntoView = vi.fn();
  scrollTo = vi.fn();
  resizeCallbacks = new Set();
  Element.prototype.scrollIntoView =
    scrollIntoView as unknown as Element["scrollIntoView"];
  Element.prototype.scrollTo = scrollTo as unknown as Element["scrollTo"];
  window.ResizeObserver = vi.fn(function ResizeObserver(
    callback: ResizeObserverCallback,
  ) {
    return createResizeObserver(callback);
  }) as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  Reflect.deleteProperty(Element.prototype, "scrollTo");
  Reflect.deleteProperty(window, "ResizeObserver");
});

describe("GameHomeScreen", () => {
  beforeEach(() => {
    onPlayProblem.mockClear();
    onPlayRandom.mockClear();
    onLevelChangesShown.mockClear();
    findProblemFeatureValues.mockClear();
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

    test("レベルごとのカードを並べ、それぞれにそのレベルの解いた問題の数を添えること", () => {
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

    test("最後に遊んだレベルのカードを選び、そのレベルの台紙だけを示すこと", () => {
      const selectedTab = screen.getByRole("tab", { selected: true });
      const sheetNames = getShownSheetNames();

      expect(selectedTab.textContent).toMatch(/^レベル 3/);
      expect(sheetNames).toEqual(["レベル 3の問題"]);
    });

    test("カードを選ぶと、そのレベルの台紙に切り替えること", () => {
      chooseLevel("レベル 1");
      const sheetNames = getShownSheetNames();

      expect(sheetNames).toEqual(["レベル 1の問題"]);
    });

    test("カードで右矢印キーを押すと、次のレベルのカードへフォーカスだけを移し、台紙を切り替えないこと", async () => {
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

    test("フォーカスのあるカードで Enter を押すと、そのレベルの台紙に切り替えること", () => {
      const tab = getLevelTab("レベル 4");
      tab.focus();

      fireEvent.keyDown(tab, { key: "Enter" });
      const sheetNames = getShownSheetNames();

      expect(sheetNames).toEqual(["レベル 4の問題"]);
    });

    test("台紙の囲みを Tab の止まり先にしないこと", () => {
      const tabPanel = screen.getByRole("tabpanel");

      expect(tabPanel.getAttribute("tabindex")).toBe("-1");
    });

    test("開いたときに、ゲーム名の見出しへフォーカスを置くこと", () => {
      const focused = document.activeElement;

      expect(focused).toBe(screen.getByRole("heading", { level: 1 }));
    });

    test("レベルを切り替えると、選んでいたマスの選択を解くこと", () => {
      fireEvent.click(getSquare("レベル 3の問題", "No.0005"));

      chooseLevel("レベル 1");
      const detailAfterSwitch = queryDetail();
      chooseLevel("レベル 3");
      const currentSquares = screen.queryAllByRole("button", { current: true });

      expect(detailAfterSwitch).toBeNull();
      expect(currentSquares).toEqual([]);
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

    test("台紙の最初のマスだけを Tab で止まるマスにすること", () => {
      const tabStops = within(getSheet("レベル 3の問題"))
        .getAllByRole("button")
        .filter((square) => square.tabIndex === 0)
        .map((square) => square.getAttribute("aria-label")?.split(" ")[0]);

      expect(tabStops).toEqual(["No.0005"]);
    });

    test("マスの見方を常には示さないこと", () => {
      const legend = screen.queryByRole("list", { name: "マスの見方" });

      expect(legend).toBeNull();
    });

    test("見方を押すと、評価段階の高い順に続けて挑戦中・未挑戦のマスの見方を示すこと", async () => {
      fireEvent.click(screen.getByRole("button", { name: "見方" }));
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
      const summary = screen.queryAllByText(/新しく解いた|段階が上がった/);
      const changedSquares = within(getSheet("レベル 3の問題"))
        .getAllByRole("button")
        .filter((square) =>
          square.getAttribute("aria-label")?.includes("前回から"),
        );

      expect(summary).toEqual([]);
      expect(changedSquares).toEqual([]);
    });

    test("マスを選ぶまで、詳細を出さないこと", () => {
      const detail = queryDetail();

      expect(detail).toBeNull();
    });

    test("解いた問題のマスを選ぶと、番号・難易度と、その問題の特徴に続けて、最高スコア・最速タイム・最短手数を添えた最少手数・最少ミス・初めてクリアした日を詳細に示すこと", () => {
      fireEvent.click(getSquare("レベル 3の問題", "No.0005"));
      const detail = getDetail();
      const facts = within(detail)
        .getAllByRole("term")
        .map((term) => [term.textContent, term.nextSibling?.textContent]);

      expect(within(detail).getByText("No.0005")).toBeTruthy();
      expect(within(detail).getByText("レベル 3")).toBeTruthy();
      expect(facts).toEqual([
        ["盤面", "9×9"],
        ["地雷", "97個"],
        ["最高スコア", "92点"],
        ["最速タイム", "01:23"],
        ["最少手数", "21手（最短 20手）"],
        ["最少ミス", "0回"],
        ["初クリア", "10/30"],
      ]);
    });

    test("手数もミスも数えないゲームの解いた問題には、問題の特徴と、最高スコア・最速タイム・初めてクリアした日だけを示すこと", () => {
      fireEvent.click(getSquare("レベル 3の問題", "No.0007"));
      const facts = within(getDetail())
        .getAllByRole("term")
        .map((term) => [term.textContent, term.nextSibling?.textContent]);

      expect(facts).toEqual([
        ["盤面", "9×9"],
        ["地雷", "99個"],
        ["最高スコア", "70点"],
        ["最速タイム", "1:02:05"],
        ["初クリア", "10/31"],
      ]);
    });

    test("途中でやめた問題のマスを選ぶと、その問題の特徴と、挑戦中であることを詳細に示すこと", () => {
      fireEvent.click(getSquare("レベル 3の問題", "No.0006"));
      const detail = getDetail();

      expect(listDetailFacts(detail)).toEqual([
        ["盤面", "9×9"],
        ["地雷", "98個"],
      ]);
      expect(within(detail).getByText("挑戦中")).toBeTruthy();
    });

    test("まだ挑んでいない問題のマスを選ぶと、その問題の特徴と、未挑戦であることを詳細に示すこと", () => {
      fireEvent.click(getSquare("レベル 3の問題", "No.0008"));
      const detail = getDetail();

      expect(listDetailFacts(detail)).toEqual([
        ["盤面", "9×9"],
        ["地雷", "100個"],
      ]);
      expect(within(detail).getByText("未挑戦")).toBeTruthy();
    });

    describe("特徴を求めた問題を数え始めた場合", () => {
      beforeEach(() => {
        describeProblem.mockClear();
      });

      test("マスを選ぶと、選んだ問題の特徴だけを求めること", () => {
        fireEvent.click(getSquare("レベル 3の問題", "No.0008"));
        const describedProblemIds = new Set(
          describeProblem.mock.calls.map(([{ problemId }]) => problemId),
        );

        expect(describedProblemIds).toEqual(new Set(["p-d"]));
      });
    });

    test("特徴を求められない問題では、特徴を示さないこと", () => {
      chooseLevel("レベル 1");
      fireEvent.click(getSquare("レベル 1の問題", "No.0001"));
      const detail = getDetail();

      expect(listDetailFacts(detail)).toEqual([]);
      expect(within(detail).getByText("未挑戦")).toBeTruthy();
    });

    test("選んだマスを、選んでいることが分かる状態にすること", () => {
      fireEvent.click(getSquare("レベル 3の問題", "No.0007"));
      const currentSquares = screen
        .getAllByRole("button", { current: true })
        .map((square) => square.getAttribute("aria-label"));

      expect(currentSquares).toEqual(["No.0007 レベル 3 最高スコア70点"]);
    });

    test("詳細の遊ぶを押すと、選んだ問題を始めること", () => {
      fireEvent.click(getSquare("レベル 3の問題", "No.0008"));
      fireEvent.click(
        within(getDetail()).getByRole("button", { name: "遊ぶ" }),
      );

      expect(onPlayProblem).toHaveBeenCalledWith(levelThreeProblems[3]);
    });

    test("マスで右矢印キーを押すと、次のマスへフォーカスを移して選び、Tab で止まるマスにすること", () => {
      const square = getSquare("レベル 3の問題", "No.0005");
      square.focus();

      fireEvent.keyDown(square, { key: "ArrowRight" });
      const focused = document.activeElement;
      const detailNumber = within(getDetail()).getByText("No.0006");

      expect(focused?.getAttribute("aria-label")).toBe(
        "No.0006 レベル 3 挑戦中",
      );
      expect(focused?.getAttribute("tabindex")).toBe("0");
      expect(square.getAttribute("tabindex")).toBe("-1");
      expect(detailNumber).toBeTruthy();
    });

    test("マスを矢印キーで移ると、移った先のマスを台紙のスクロール領域の見える範囲へ寄せること", () => {
      const square = getSquare("レベル 3の問題", "No.0005");
      square.focus();

      fireEvent.keyDown(square, { key: "ArrowRight" });
      const scrolledSquares = scrollIntoView.mock.contexts
        .filter((context) => getSheet("レベル 3の問題").contains(context))
        .map((context) => (context as Element).getAttribute("aria-label"));

      expect(scrolledSquares).toEqual(["No.0006 レベル 3 挑戦中"]);
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: "nearest",
        inline: "nearest",
      });
    });

    describe("マスを選んでいる場合", () => {
      beforeEach(() => {
        fireEvent.click(getSquare("レベル 3の問題", "No.0007"));
      });

      test("選んでいるマスをもう一度押すと、詳細を閉じて選択を解くこと", () => {
        fireEvent.click(getSquare("レベル 3の問題", "No.0007"));
        const detail = queryDetail();
        const currentSquares = screen.queryAllByRole("button", {
          current: true,
        });

        expect(detail).toBeNull();
        expect(currentSquares).toEqual([]);
      });

      test("閉じるボタンを押すと、詳細を閉じること", () => {
        fireEvent.click(
          within(getDetail()).getByRole("button", { name: "閉じる" }),
        );
        const detail = queryDetail();

        expect(detail).toBeNull();
      });

      test("Escape を押すと、詳細を閉じること", () => {
        fireEvent.keyDown(document.body, { key: "Escape" });
        const detail = queryDetail();

        expect(detail).toBeNull();
      });

      test("別のマスを押すと、詳細をそのマスの問題に切り替えること", () => {
        fireEvent.click(getSquare("レベル 3の問題", "No.0008"));
        const detail = getDetail();

        expect(within(detail).getByText("No.0008")).toBeTruthy();
        expect(within(detail).queryByText("No.0007")).toBeNull();
      });

      describe("閉じるボタンにフォーカスがある場合", () => {
        beforeEach(() => {
          within(getDetail()).getByRole("button", { name: "閉じる" }).focus();
        });

        test("閉じるボタンで閉じると、フォーカスを選んでいたマスへ戻すこと", () => {
          fireEvent.click(
            within(getDetail()).getByRole("button", { name: "閉じる" }),
          );
          const focused = document.activeElement;

          expect(focused).toBe(getSquare("レベル 3の問題", "No.0007"));
        });
      });

      describe("見方を開いている場合", () => {
        beforeEach(async () => {
          fireEvent.click(screen.getByRole("button", { name: "見方" }));
          await screen.findByRole("list", { name: "マスの見方" });
        });

        test("Escape では見方だけを閉じ、詳細を閉じないこと", async () => {
          fireEvent.keyDown(screen.getByRole("list", { name: "マスの見方" }), {
            key: "Escape",
          });
          await waitFor(() => {
            expect(
              screen.queryByRole("list", { name: "マスの見方" }),
            ).toBeNull();
          });
          const detailNumber = within(getDetail()).getByText("No.0007");

          expect(detailNumber).toBeTruthy();
        });
      });
    });

    describe("詳細を台紙に重ねる幅で、マスを選んだ場合", () => {
      const detailHeight = 140;

      beforeEach(() => {
        vi.stubGlobal(
          "matchMedia",
          vi.fn(
            (query: string) =>
              ({
                matches: query === "(width < 64rem)",
                addEventListener: () => {},
                removeEventListener: () => {},
              }) as unknown as MediaQueryList,
          ),
        );
        fireEvent.click(getSquare("レベル 3の問題", "No.0008"));
        scrollIntoView.mockClear();
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      test("詳細の高さが分かると、台紙の下端に詳細の高さのスクロール余白を取り、選んだマスを見える範囲へ寄せ直すこと", () => {
        resizeObservedElements(detailHeight);
        const coveredBottom =
          getSheetScroller("レベル 3の問題").style.getPropertyValue(
            "--covered-bottom",
          );
        const scrolledSquares = scrollIntoView.mock.contexts.map((context) =>
          (context as Element).getAttribute("aria-label"),
        );

        expect(coveredBottom).toBe(`${detailHeight}px`);
        expect(scrolledSquares).toEqual(["No.0008 レベル 3 未挑戦"]);
        expect(scrollIntoView).toHaveBeenCalledWith({
          block: "nearest",
          inline: "nearest",
        });
      });

      describe("詳細の高さが分かったあと", () => {
        beforeEach(() => {
          resizeObservedElements(detailHeight);
        });

        test("詳細を閉じると、台紙の下端のスクロール余白を無くすこと", () => {
          fireEvent.keyDown(document.body, { key: "Escape" });
          const coveredBottom =
            getSheetScroller("レベル 3の問題").style.getPropertyValue(
              "--covered-bottom",
            );

          expect(coveredBottom).toBe("0px");
        });
      });
    });

    describe("詳細を台紙の横に置く幅で、マスを選んだ場合", () => {
      beforeEach(() => {
        fireEvent.click(getSquare("レベル 3の問題", "No.0008"));
      });

      test("詳細の高さが分かっても、台紙の下端にスクロール余白を取らないこと", () => {
        resizeObservedElements(140);
        const coveredBottom =
          getSheetScroller("レベル 3の問題").style.getPropertyValue(
            "--covered-bottom",
          );

        expect(coveredBottom).toBe("0px");
      });
    });

    test("ホームへ戻る導線を示すこと", () => {
      const backLink = screen.getByRole("link", { name: "戻る" });

      expect(backLink.getAttribute("href")).toBe("/");
    });

    test("レベルのカードに、そのレベルの盤面の見本を描くこと", () => {
      const previews = within(screen.getByRole("tablist", { name: "レベル" }))
        .getAllByRole("tab")
        .map((tab) =>
          tab
            .querySelector("[data-level-preview]")
            ?.getAttribute("data-level-preview"),
        );

      expect(previews).toEqual(["1", "2", "3", "4", "5"]);
    });

    test("ランダムに遊ぶを押すと、開いているレベルでプレイを始めること", () => {
      fireEvent.click(screen.getByRole("button", { name: "ランダムに遊ぶ" }));

      expect(onPlayRandom.mock.calls).toEqual([["3"]]);
    });

    test("遊び方を押すと、ゲームの遊び方を開くこと", () => {
      fireEvent.click(screen.getByRole("button", { name: "遊び方" }));

      const dialog = screen.getByText("遊び方のダイアログ");

      expect(dialog).toBeTruthy();
    });

    test("絞り込みを開くまで、問題の特徴の値を求めないこと", () => {
      const calls = findProblemFeatureValues.mock.calls;

      expect(calls).toEqual([]);
    });

    test("絞り込みの条件をかけるまで、マスを並べ替えず、当たった数を示さないこと", () => {
      const order = listSquareOrder("レベル 3の問題");
      const filterButton = getFilterButton();
      const matchedCount = getShownMatchedCount();

      expect(order).toEqual(["No.0005", "No.0006", "No.0007", "No.0008"]);
      expect(filterButton.getAttribute("aria-label")).toBe("絞り込み");
      expect(matchedCount).toBeNull();
    });
  });

  describe("絞り込みを開いた場合", () => {
    let panel: HTMLElement;

    beforeEach(async () => {
      renderScreen();
      fireEvent.click(getFilterButton());
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
      fireEvent.click(getFilterButton());
      await screen.findByRole("dialog", { name: "絞り込み" });

      expect(findProblemFeatureValues).toHaveBeenCalledTimes(callCount);
    });

    test("条件を付け外ししても、見出し・カード・台紙の上の並びの要素を足し引きしないこと", () => {
      const header = screen.getByRole("banner");
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

    test("条件をかけていない間も、絞り込みボタンの条件の数の印の場所を見えなくして取っておくこと", () => {
      const mark = getFilterButton().querySelector(
        "[data-condition-count-mark]",
      );
      const hiddenBefore = mark?.classList.contains("invisible");

      chooseFilterOption(panel, "状態", "未挑戦");

      expect(hiddenBefore).toBe(true);
      expect(mark?.classList.contains("invisible")).toBe(false);
      expect(mark?.textContent).toContain("1");
    });

    test("条件を変えると、台紙を先頭までスクロールすること", () => {
      const scroller = getSheetScroller("レベル 3の問題");
      scroller.scrollTop = 120;

      chooseFilterOption(panel, "状態", "未挑戦");

      expect(scroller.scrollTop).toBe(0);
    });

    describe("マスを選んでから並びを変えた場合", () => {
      beforeEach(() => {
        fireEvent.click(getSquare("レベル 3の問題", "No.0006"));
        scrollIntoView.mockClear();
        chooseFilterOption(panel, "状態", "未挑戦");
      });

      test("選んでいるマスを Tab で止まるマスにし、選んでいるマスへ寄せ直さないこと", () => {
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
        expect(scrollIntoView).not.toHaveBeenCalled();
      });

      test("Tab で止まるマスから右矢印キーを押すと、見えている並びで選んでいるマスの次へ移って選ぶこと", () => {
        const tabStop = within(getSheet("レベル 3の問題"))
          .getAllByRole("button")
          .find((square) => square.tabIndex === 0);
        tabStop?.focus();

        fireEvent.keyDown(document.activeElement ?? document.body, {
          key: "ArrowRight",
        });
        const focusedName = document.activeElement?.getAttribute("aria-label");
        const detail = getDetail();

        expect(focusedName).toBe(
          "No.0007 レベル 3 最高スコア70点 絞り込みの条件外",
        );
        expect(within(detail).getByText("No.0007")).toBeTruthy();
      });
    });

    test("マスを選ばずに並びを変えると、見えている並びの最初のマスを Tab で止まるマスにすること", () => {
      chooseFilterOption(panel, "状態", "未挑戦");
      const tabStops = within(getSheet("レベル 3の問題"))
        .getAllByRole("button")
        .filter((square) => square.tabIndex === 0)
        .map((square) => square.getAttribute("aria-label"));

      expect(tabStops).toEqual(["No.0008 レベル 3 未挑戦"]);
    });

    test("条件が無い間は、解除を押せないことを示し、押しても何もしないこと", () => {
      const clearButton = within(panel).getByRole("button", { name: "解除" });
      clearButton.focus();

      fireEvent.click(clearButton);

      expect(clearButton.getAttribute("aria-disabled")).toBe("true");
      expect(getFilterButton().getAttribute("aria-label")).toBe("絞り込み");
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

      test("台紙の上と絞り込みに当たった数を、絞り込みボタンに条件の数を示し、カードは変えないこと", () => {
        const openTab = screen.getByRole("tab", { selected: true });
        const panelCount = within(panel).getByText(/^該当/).textContent;
        const filterButton = getFilterButton();

        expect(readLevelCardName(openTab)).toBe("レベル 3、4問中2問を解いた");
        expect(getShownMatchedCount()).toBe("該当 2問");
        expect(panelCount).toBe("該当 2問");
        expect(filterButton.getAttribute("aria-label")).toBe(
          "絞り込み、条件2つ",
        );
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
        const filterButton = getFilterButton();

        expect(order).toEqual(["No.0005", "No.0006", "No.0007", "No.0008"]);
        expect(filterButton.getAttribute("aria-label")).toBe("絞り込み");
      });

      test("マスで右矢印キーを押すと、並べた順の次のマスへ移って選ぶこと", () => {
        const first = getSquare("レベル 3の問題", "No.0006");
        first.focus();

        fireEvent.keyDown(first, { key: "ArrowRight" });
        const focusedName = document.activeElement?.getAttribute("aria-label");
        const detail = getDetail();

        expect(focusedName).toBe("No.0008 レベル 3 未挑戦");
        expect(within(detail).getByText("No.0008")).toBeTruthy();
      });

      test("当たらなかったマスも選んで詳細を出し、遊ぶでその問題を始められること", () => {
        fireEvent.click(getSquare("レベル 3の問題", "No.0007"));
        fireEvent.click(
          within(getDetail()).getByRole("button", { name: "遊ぶ" }),
        );
        const startedProblemIds = onPlayProblem.mock.calls.map(
          ([problem]) => problem.problemId,
        );

        expect(startedProblemIds).toEqual(["p-c"]);
      });

      test("レベルを切り替えると、条件を外すこと", () => {
        chooseLevel("レベル 1");
        const filterButton = getFilterButton();
        const order = listSquareOrder("レベル 1の問題");

        expect(filterButton.getAttribute("aria-label")).toBe("絞り込み");
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
      fireEvent.click(getFilterButton());
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
      fireEvent.click(getFilterButton());
      const panel = await screen.findByRole("dialog", { name: "絞り込み" });
      chooseFilterOption(panel, "状態", "未挑戦");
      rerender(createScreen());
    });

    test("前のレベルにかけた条件を、新しく開いたレベルにかけないこと", () => {
      const sheetNames = getShownSheetNames();
      const order = listSquareOrder("レベル 3の問題");
      const filterButton = getFilterButton();

      expect(sheetNames).toEqual(["レベル 3の問題"]);
      expect(order).toEqual(["No.0005", "No.0006", "No.0007", "No.0008"]);
      expect(filterButton.getAttribute("aria-label")).toBe("絞り込み");
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
      newlySolvedCount: 2,
      raisedCount: 1,
    };
    const finalSummary = "新しく解いた 2問・段階が上がった 1問";

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

    function getSummaryText(): string | null | undefined {
      return screen.getAllByText(/新しく解いた|段階が上がった/)[0]?.closest("p")
        ?.textContent;
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
      await advanceStamps(1600);
    }

    function tap(target: Element, { x, y }: { x: number; y: number }) {
      fireEvent.pointerDown(target, { pointerId: 1, clientX: x, clientY: y });
      fireEvent.pointerUp(target, { pointerId: 1, clientX: x, clientY: y });
    }

    let animate: ReturnType<typeof vi.fn>;
    let reducedMotionListeners: Set<() => void>;
    let prefersReduced: boolean;

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
      HTMLElement.prototype.animate =
        animate as unknown as HTMLElement["animate"];
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      Reflect.deleteProperty(HTMLElement.prototype, "animate");
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

        test("1行には、全レベルを合わせた前回からの変化の数を最初から示すこと", () => {
          const summary = getSummaryText();

          expect(summary).toBe(finalSummary);
        });

        test("開いているレベルの状態ごとの数とカードの数を前回の数から始め、画面全体の解いた数をカードの数の合計にすること", () => {
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

        test("マスの読み上げ名は、変化とともに今の状態を示すこと", () => {
          const names = getChangedSquareNames("レベル 3の問題");

          expect(names).toEqual([
            "No.0005 レベル 3 最高スコア92点 前回から段階が上がった",
            "No.0007 レベル 3 最高スコア70点 前回から新しく解いた",
          ]);
        });

        test("開いていないレベルのうち、変化のあるレベルのカードにだけ印を付けること", () => {
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

        test("段階が上がったマスを押しても、1行の数を変えないこと", () => {
          const summary = getSummaryText();

          expect(summary).toBe(finalSummary);
        });
      });

      describe("押し終えた場合", () => {
        beforeEach(async () => {
          await finishStamps();
        });

        test("変化したマスを、1マスごとに押す姿・浮いた影・戻り・輪の4つずつ動かしたこと", () => {
          const animatedCount = animate.mock.calls.length;

          expect(animatedCount).toBe(8);
        });

        test("マスを今の姿で描き、変化の段階を残さないこと", () => {
          const stages = getChangeStages("レベル 3の問題");

          expect(stages).toEqual([null, null, null, null]);
        });

        test("開いているレベルの数を今の数まで数え上げて未挑戦の数を減らし、まだ開いていないレベルのカードは前回の数のまま印を残すこと", () => {
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

        test("画面全体の解いた数を、カードの数の合計に合わせること", () => {
          const solvedCount = getShownSolvedCount();

          expect(solvedCount).toBe(sumTabSolvedCounts());
        });

        test("開いているレベルの変化だけを見せ終えたと知らせること", () => {
          const shownDifficulties = onLevelChangesShown.mock.calls;

          expect(shownDifficulties).toEqual([["3"]]);
        });

        test("マスを選べること", () => {
          fireEvent.click(getSquare("レベル 3の問題", "No.0007"));
          const detailNumber = within(getDetail()).getByText("No.0007");

          expect(detailNumber).toBeTruthy();
        });
      });

      describe("押している途中でタップした場合", () => {
        beforeEach(async () => {
          await advanceStamps(400);
          tap(document.body, { x: 10, y: 10 });
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
          fireEvent.click(getSquare("レベル 3の問題", "No.0007"));
          const detailAfterSkip = queryDetail();
          fireEvent.pointerDown(getSquare("レベル 3の問題", "No.0007"), {
            pointerId: 1,
          });
          fireEvent.click(getSquare("レベル 3の問題", "No.0007"));
          const detailNumber = within(getDetail()).queryByText("No.0007");

          expect(detailAfterSkip).toBeNull();
          expect(detailNumber).toBeTruthy();
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

        test("絞り込みボタンを1回タップすると、最後の姿まで飛ばして絞り込みを開くこと", () => {
          const filterButton = getFilterButton();

          tap(filterButton, { x: 10, y: 10 });
          fireEvent.click(filterButton);
          const stages = getChangeStages("レベル 3の問題");
          const panel = screen.queryByRole("dialog", { name: "絞り込み" });

          expect(stages).toEqual([null, null, null, null]);
          expect(panel).not.toBeNull();
          expect(onLevelChangesShown.mock.calls).toEqual([["3"]]);
        });

        test("見方ボタンを1回タップすると、最後の姿まで飛ばして見方を開くこと", () => {
          const legendButton = screen.getByRole("button", { name: "見方" });

          tap(legendButton, { x: 10, y: 10 });
          fireEvent.click(legendButton);
          const legend = screen.queryByRole("list", { name: "マスの見方" });

          expect(getChangeStages("レベル 3の問題")).toEqual([
            null,
            null,
            null,
            null,
          ]);
          expect(legend).not.toBeNull();
        });

        test("最後の姿まで飛ばし、見せ終えたと知らせること", () => {
          fireEvent.click(getFilterButton());
          const stages = getChangeStages("レベル 3の問題");
          const shownDifficulties = onLevelChangesShown.mock.calls;

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

          expect(animate.mock.calls.length).toBe(4);
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
        newlySolvedCount: 15,
        raisedCount: 0,
      };
      let samples: { untouched: number; solved: number; total: number }[];

      function readUntouchedCount(): number {
        const name = getStatusCountNames().find((item) =>
          item?.startsWith("未挑戦"),
        );
        return Number(name?.match(/\d+/)?.[0]);
      }

      beforeEach(async () => {
        renderScreen(manyZukan, manyChanges);
        samples = [];
        for (let elapsedMs = 0; elapsedMs < 1800; elapsedMs += 20) {
          samples.push({
            untouched: readUntouchedCount(),
            solved: Number(getTabCounts()[1]?.split(" / ")[0]),
            total: getShownSolvedCount(),
          });
          await advanceStamps(20);
        }
        samples.push({
          untouched: readUntouchedCount(),
          solved: Number(getTabCounts()[1]?.split(" / ")[0]),
          total: getShownSolvedCount(),
        });
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

      test("画面全体の解いた数を、常にカードの数の合計に合わせること", () => {
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

      test("数え上げずに、画面全体の解いた数・カードの数を今の数で示すこと", () => {
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

      test("まだ見せていない変化のあるレベルのカードに印を付けること", () => {
        const markedTabs = getMarkedTabNames();

        expect(markedTabs).toEqual(["レベル 1"]);
      });
    });

    describe("選んでおく問題の詳細を出したまま押している途中の場合", () => {
      beforeEach(async () => {
        renderScreen(changedZukan, changes, "p-c");
        await advanceStamps(400);
      });

      test("詳細の遊ぶを1回タップすると、最後の姿まで飛ばしてその問題を始めること", () => {
        const playButton = within(getDetail()).getByRole("button", {
          name: "遊ぶ",
        });

        tap(playButton, { x: 10, y: 10 });
        fireEvent.click(playButton);
        const startedProblemIds = onPlayProblem.mock.calls.map(
          ([problem]) => problem.problemId,
        );

        expect(getChangeStages("レベル 3の問題")).toEqual([
          null,
          null,
          null,
          null,
        ]);
        expect(startedProblemIds).toEqual(["p-c"]);
      });

      test("ランダムに遊ぶを1回タップすると、最後の姿まで飛ばして開いているレベルで始めること", () => {
        const playRandom = screen.getByRole("button", {
          name: "ランダムに遊ぶ",
        });

        tap(playRandom, { x: 10, y: 10 });
        fireEvent.click(playRandom);

        expect(onPlayRandom.mock.calls).toEqual([["3"]]);
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
    let rerender: ReturnType<typeof render>["rerender"];

    beforeEach(() => {
      ({ rerender } = renderScreen());
      scrollIntoView.mockClear();
    });

    test("新しく開いたレベルのカードを見える位置へ送ること", () => {
      rerender(createScreen({ ...zukan, latestPlayedDifficulty: "5" }));
      const scrolled = scrollIntoView.mock.contexts;

      expect(scrolled).toEqual([getLevelTab("レベル 5")]);
    });

    test("カードを触ったあとは、開いたレベルのカードへ送らないこと", () => {
      fireEvent.pointerDown(screen.getByRole("tablist", { name: "レベル" }));
      rerender(createScreen({ ...zukan, latestPlayedDifficulty: "5" }));
      const scrolled = scrollIntoView.mock.contexts;

      expect(scrolled).toEqual([]);
    });
  });

  describe("端で切れたカードを押した場合", () => {
    beforeEach(() => {
      renderScreen();
      scrollIntoView.mockClear();
    });

    test("押したカードを見える位置へ送ること", () => {
      fireEvent.click(getLevelTab("レベル 5"));
      const scrolled = scrollIntoView.mock.contexts;

      expect(scrolled).toEqual([getLevelTab("レベル 5")]);
      expect(scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ block: "nearest", inline: "nearest" }),
      );
    });
  });

  describe("そのゲームを遊んだことが無い場合", () => {
    beforeEach(() => {
      renderScreen({ ...zukan, latestPlayedDifficulty: null });
    });

    test("どのレベルのカードも選ばず、台紙を示さないこと", () => {
      const selectedTab = screen.queryByRole("tab", { selected: true });
      const sheet = screen.queryByRole("tabpanel");

      expect(selectedTab).toBeNull();
      expect(sheet).toBeNull();
    });

    test("カードを縦に並べ、ランダムに遊ぶを出さないこと", () => {
      const arrangement = screen.getByRole("tablist", { name: "レベル" })
        .dataset.cardArrangement;
      const playRandom = screen.queryByRole("button", {
        name: "ランダムに遊ぶ",
      });

      expect(arrangement).toBe("list");
      expect(playRandom).toBeNull();
    });

    test("絞り込みを押せない姿にすること", () => {
      const filterButton = getFilterButton();

      expect(filterButton.hasAttribute("disabled")).toBe(true);
    });

    test("Tab でカードに入っても、レベルを選ばないこと", () => {
      const tab = getLevelTab("レベル 2");

      fireEvent.focus(tab);
      const selectedTab = screen.queryByRole("tab", { selected: true });

      expect(selectedTab).toBeNull();
    });

    describe("カードを選んだ場合", () => {
      beforeEach(() => {
        scrollIntoView.mockClear();
        chooseLevel("レベル 2");
      });

      test("そのレベルの台紙を示すこと", () => {
        const sheetNames = getShownSheetNames();

        expect(sheetNames).toEqual(["レベル 2の問題"]);
      });

      test("カードを1行に並べ直し、選んだカードを見える位置へすぐ送ること", () => {
        const arrangement = screen.getByRole("tablist", { name: "レベル" })
          .dataset.cardArrangement;

        expect(arrangement).toBe("scroll");
        expect(scrollIntoView.mock.contexts).toEqual([getLevelTab("レベル 2")]);
        expect(scrollIntoView).toHaveBeenCalledWith({
          behavior: "instant",
          block: "nearest",
          inline: "nearest",
        });
      });

      test("ランダムに遊ぶを押すと、選んだレベルでプレイを始めること", () => {
        fireEvent.click(screen.getByRole("button", { name: "ランダムに遊ぶ" }));

        expect(onPlayRandom.mock.calls).toEqual([["2"]]);
      });
    });
  });

  describe("選んでおく問題を渡した場合", () => {
    beforeEach(() => {
      renderScreen(zukan, noZukanChanges, "p-1-1");
    });

    test("その問題のレベルを、最後に遊んだレベルより優先して開くこと", () => {
      const selectedTab = screen.getByRole("tab", { selected: true });
      const sheetNames = getShownSheetNames();

      expect(selectedTab.textContent).toMatch(/^レベル 1/);
      expect(sheetNames).toEqual(["レベル 1の問題"]);
    });

    test("その問題のマスへフォーカスを置くこと", () => {
      const focused = document.activeElement;

      expect(focused).toBe(getSquare("レベル 1の問題", "No.0002"));
    });

    test("その問題のマスを選び、詳細を出すこと", () => {
      const square = getSquare("レベル 1の問題", "No.0002");
      const detail = getDetail();

      expect(square.getAttribute("aria-current")).toBe("true");
      expect(within(detail).getByText("No.0002")).toBeTruthy();
    });
  });

  describe("図鑑に無い問題を選んでおく問題として渡した場合", () => {
    beforeEach(() => {
      renderScreen(zukan, noZukanChanges, "unknown-problem");
    });

    test("最後に遊んだレベルを開き、どのマスも選ばないこと", () => {
      const selectedTab = screen.getByRole("tab", { selected: true });
      const detail = queryDetail();

      expect(selectedTab.textContent).toMatch(/^レベル 3/);
      expect(detail).toBeNull();
    });
  });
});

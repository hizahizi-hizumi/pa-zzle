import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { Tabs } from "@/components/ui/tabs";
import {
  type GameLevel,
  GameLevelRail,
} from "@/zukan/ui/GameHomeScreen/GameLevelRail";

const levels: readonly GameLevel[] = [
  {
    difficulty: "1",
    problemCount: 30,
    solvedCount: 0,
    hasUnseenChanges: false,
  },
  { difficulty: "2", problemCount: 30, solvedCount: 4, hasUnseenChanges: true },
  {
    difficulty: "3",
    problemCount: 240,
    solvedCount: 12,
    hasUnseenChanges: false,
  },
];

function getRail(): HTMLElement {
  return screen.getByRole("tablist", { name: "レベル" });
}

/** 読み上げる名前と同じく、見せるだけの要素を除いたレベルの文字。 */
function readSpokenText(tab: Element): string | null {
  const spoken = tab.cloneNode(true) as Element;
  for (const hidden of spoken.querySelectorAll('[aria-hidden="true"]')) {
    hidden.remove();
  }
  return spoken.textContent;
}

/** 見せるだけの要素に描いた、解いた数と全問の数。 */
function readShownCount(tab: Element): string | null | undefined {
  return [...tab.querySelectorAll('[aria-hidden="true"]')].find((hidden) =>
    hidden.textContent?.includes("/"),
  )?.textContent;
}

afterEach(() => {
  cleanup();
});

describe("GameLevelRail", () => {
  const onValueChange = vi.fn();

  beforeEach(() => {
    onValueChange.mockClear();
    render(
      <Tabs value="2" onValueChange={onValueChange} activationMode="manual">
        <GameLevelRail levels={levels} />
      </Tabs>,
    );
  });

  test("レベルを難易度の順に並べ、読み上げ名にレベルの名前と解いた数を全問の数と並べて持たせること", () => {
    const names = within(getRail()).getAllByRole("tab").map(readSpokenText);

    expect(names).toEqual([
      "レベル 1、30問中0問を解いた",
      "レベル 2、30問中4問を解いた、前回から変化あり",
      "レベル 3、240問中12問を解いた",
    ]);
  });

  test("解いた数を全問の数と並べて見せること", () => {
    const counts = within(getRail()).getAllByRole("tab").map(readShownCount);

    expect(counts).toEqual(["0 / 30", "4 / 30", "12 / 240"]);
  });

  test("まだ見せていない変化のあるレベルにだけ印を付けること", () => {
    const markedTabs = within(getRail())
      .getAllByRole("tab")
      .filter((tab) => tab.querySelector("[data-unseen-change-mark]"))
      .map((tab) => readSpokenText(tab)?.split("、")[0]);

    expect(markedTabs).toEqual(["レベル 2"]);
  });

  test("開いているレベルを選んだレベルとして示すこと", () => {
    const selectedTab = within(getRail()).getByRole("tab", { selected: true });

    expect(readSpokenText(selectedTab)).toMatch(/^レベル 2、/);
  });

  test("レベルを押すと、そのレベルを選んだと知らせること", () => {
    fireEvent.mouseDown(
      within(getRail()).getByRole("tab", { name: /^レベル 3、/ }),
      { button: 0, ctrlKey: false },
    );

    expect(onValueChange.mock.calls).toEqual([["3"]]);
  });
});

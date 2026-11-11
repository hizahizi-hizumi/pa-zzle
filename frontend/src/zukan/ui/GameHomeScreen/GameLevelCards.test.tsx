import { cleanup, render, screen, within } from "@testing-library/react";

import { Tabs } from "@/components/ui/tabs";
import {
  type GameLevelCard,
  GameLevelCards,
} from "@/zukan/ui/GameHomeScreen/GameLevelCards";

afterEach(cleanup);

const levels: readonly GameLevelCard[] = [
  {
    difficulty: "1",
    problemCount: 300,
    solvedCount: 177,
    hasUnseenChanges: false,
  },
  {
    difficulty: "2",
    problemCount: 300,
    solvedCount: 0,
    hasUnseenChanges: true,
  },
  { difficulty: "3", problemCount: 4, solvedCount: 2, hasUnseenChanges: false },
];

/** 読み上げる名前と同じく、見せるだけの要素を除いたカードの文字。 */
function readCardName(tab: Element): string | null {
  const shown = tab.cloneNode(true) as Element;
  for (const hidden of shown.querySelectorAll('[aria-hidden="true"]')) {
    hidden.remove();
  }
  return shown.textContent;
}

function listCards(): HTMLElement[] {
  return within(screen.getByRole("tablist", { name: "レベル" })).getAllByRole(
    "tab",
  );
}

describe("GameLevelCards", () => {
  beforeEach(() => {
    render(
      <Tabs value="3">
        <GameLevelCards levels={levels} />
      </Tabs>,
    );
  });

  test("レベルごとに、レベルの名前と、全問の数のうち解いた数を読み上げ名に含めたカードを並べること", () => {
    const names = listCards().map(readCardName);

    expect(names).toEqual([
      "レベル 1、300問中177問を解いた",
      "レベル 2、300問中0問を解いた、前回から変化あり",
      "レベル 3、4問中2問を解いた",
    ]);
  });

  test("解いた数と全問の数を、空白を挟まずに斜線で並べて見せること", () => {
    const shownCount = within(listCards()[0] as HTMLElement).getByText(
      "177/300",
    );

    expect(shownCount.getAttribute("aria-hidden")).toBe("true");
  });

  test("まだ見せていない変化のあるレベルのカードにだけ、見せるだけの点を付けること", () => {
    const markedCards = listCards().map(
      (card) => card.querySelector("[data-unseen-change-mark]") !== null,
    );

    expect(markedCards).toEqual([false, true, false]);
  });

  test("開いているレベルのカードを選んだ姿にすること", () => {
    const selected = screen.getByRole("tab", { selected: true });

    expect(readCardName(selected)).toBe("レベル 3、4問中2問を解いた");
  });
});

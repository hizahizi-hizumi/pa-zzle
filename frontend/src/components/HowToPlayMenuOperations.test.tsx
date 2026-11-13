import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { HowToPlayMenuOperations } from "@/components/HowToPlayMenuOperations";
import { PlayHeader } from "@/components/PlayHeader";
import { playMenuOperationItems } from "@/components/play-menu-operations";

afterEach(cleanup);

const operationLabels = ["盤面を戻す", "リセット", "別の問題"] as const;

/**
 * 項目の見え方。名前・取り消しの色かどうか・アイコンを並べる。
 * 本番のメニューの項目と遊び方の図の項目は、同じ項目の定義から描くので、同じ印が付く。
 */
function describeItem(name: string | null | undefined, item: Element): string {
  return [
    name,
    item.getAttribute("data-variant"),
    item.querySelector("svg")?.getAttribute("class"),
  ].join("|");
}

function findFigureItem(label: string): Element | undefined {
  return [...document.querySelectorAll("[data-variant]")].find(
    (item) => item.querySelector("p > span")?.textContent === label,
  );
}

describe("HowToPlayMenuOperations", () => {
  let productionItems: string[] = [];
  let productionTriggerClassName: string | null = null;

  beforeEach(() => {
    render(
      <PlayHeader
        title="テストパズル"
        metrics={[]}
        canRestart
        onRestart={vi.fn()}
        onReplay={vi.fn()}
        onStartNewProblem={vi.fn()}
        onOpenGameHome={vi.fn()}
        onBackToAppHome={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("button", { name: "その他の操作" });
    productionTriggerClassName = trigger.getAttribute("class");
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    productionItems = operationLabels.map((label) =>
      describeItem(label, screen.getByRole("menuitem", { name: label })),
    );
    cleanup();
    render(
      <ul>
        <HowToPlayMenuOperations
          operations={[
            { item: playMenuOperationItems.restart, text: "戻す。" },
            { item: playMenuOperationItems.replay, text: "やり直す。" },
            {
              item: playMenuOperationItems.startNewProblem,
              text: "変える。",
            },
          ]}
        />
      </ul>,
    );
  });

  test("図の項目を、本番のメニューの項目と同じ名前・取り消しの色・アイコンで描くこと", () => {
    const figureItems = operationLabels.map((label) => {
      const item = findFigureItem(label);
      return item === undefined ? undefined : describeItem(label, item);
    });

    expect(figureItems).toEqual(productionItems);
  });

  test("「…」ボタンの図を、本番のメニューを開く前のボタンと同じ見た目で描くこと", () => {
    const figureTrigger = document.querySelector("[inert] button");

    expect(figureTrigger?.getAttribute("class")).toBe(
      productionTriggerClassName,
    );
  });

  test("「…」ボタンを本番の名前で呼ぶ一文に続けて、文を本番のメニューの項目の名前と組にして読み上げること", () => {
    const texts = screen
      .getAllByRole("paragraph")
      .map((paragraph) => paragraph.textContent);

    expect(texts).toEqual([
      "「その他の操作」から選びます。",
      "盤面を戻す：戻す。",
      "リセット：やり直す。",
      "別の問題：変える。",
    ]);
  });
});

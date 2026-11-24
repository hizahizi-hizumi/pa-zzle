import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { SolitaireHowToPlayDialog } from "@/games/solitaire/ui/SolitaireHowToPlayDialog";

afterEach(cleanup);

function getDialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "ソリティアの遊び方" });
}

function openTab(name: string): HTMLElement {
  fireEvent.mouseDown(within(getDialog()).getByRole("tab", { name }), {
    button: 0,
    ctrlKey: false,
  });
  return within(getDialog()).getByRole("tabpanel", { name });
}

/** 図の下に見えている言葉。入れ替える言葉の層のうち、見せている層だけを読む。 */
function readShownCaptions(panel: HTMLElement): string[] {
  return [
    ...panel.querySelectorAll<HTMLElement>(
      '[data-how-to-play-caption-layer]:not([aria-hidden="true"])',
    ),
  ].map((layer) => layer.textContent ?? "");
}

describe("SolitaireHowToPlayDialog", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    render(<SolitaireHowToPlayDialog open onClose={vi.fn()} />);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("入口に、本番の盤面部品で描いたゴールの盤面を見せること", () => {
    const goal = within(getDialog()).getByRole("img", { name: "ゴールの盤面" });

    expect(goal).toBeTruthy();
  });

  test("ルールの例の言葉を、本番の判定から求めて添えること", () => {
    const rules = openTab("ルール");

    const captions = readShownCaptions(rules);

    expect(captions).toEqual([
      "置ける、置けない",
      "3枚が動く",
      "2枚が動く",
      "置ける",
      "置けない",
      "置ける",
      "置けない",
      "戻せる",
      "戻せない",
    ]);
  });

  test("操作のメニューに、盤面を戻すと別の問題だけを載せ、リセットを載せないこと", () => {
    const operations = openTab("操作");

    const items = ["盤面を戻す", "別の問題", "リセット"].map(
      (name) => within(operations).queryByText(name) !== null,
    );

    expect(items).toEqual([true, true, false]);
  });

  test("操作に、状態の知らせを、プレイ画面と同じ言葉の見出しで載せること", () => {
    const operations = openTab("操作");

    const heading = within(operations).getByRole("heading", {
      name: "組札へ運べない",
    });

    expect(heading).toBeTruthy();
  });

  test("採点に、安定性60点と速さ40点を載せること", () => {
    const scoring = openTab("採点");

    const headings = within(scoring)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(headings).toEqual(["安定性 60点", "速さ 40点"]);
  });
});

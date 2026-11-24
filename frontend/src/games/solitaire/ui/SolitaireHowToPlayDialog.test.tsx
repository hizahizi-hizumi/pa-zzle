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

function listVerdicts(panel: HTMLElement): (string | null)[] {
  return within(panel)
    .getAllByRole("figure")
    .map((figure) => figure.getAttribute("aria-labelledby"))
    .filter((id) => id !== null)
    .map((id) => document.getElementById(id)?.textContent ?? null);
}

describe("SolitaireHowToPlayDialog", () => {
  beforeEach(() => {
    render(<SolitaireHowToPlayDialog open onClose={vi.fn()} />);
  });

  test("ゴールに、4つの組札がKまで積み上がった盤面を見せること", () => {
    const goal = within(getDialog()).getByRole("img", {
      name: "4つの組札が、どれもKまで積み上がった盤面",
    });

    expect(goal).toBeTruthy();
  });

  test("ルールの例の判定を、プレイと同じ規則で添えること", () => {
    const rules = openTab("ルール");

    const verdicts = listVerdicts(rules);

    expect(verdicts).toEqual([
      expect.stringContaining("重ねられる"),
      expect.stringContaining("重ねられない"),
      "3枚まで、まとめて動かせる",
      expect.stringContaining("置ける"),
      expect.stringContaining("置けない"),
      expect.stringContaining("置ける"),
      expect.stringContaining("置けない"),
    ]);
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

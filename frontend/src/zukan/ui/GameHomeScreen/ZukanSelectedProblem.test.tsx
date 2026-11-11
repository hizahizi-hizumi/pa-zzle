import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createRef } from "react";

import { ZukanSelectedProblem } from "@/zukan/ui/GameHomeScreen/ZukanSelectedProblem";
import type { ZukanProblem } from "@/zukan/zukan-collection";

afterEach(cleanup);

const solvedProblem: ZukanProblem = {
  kind: "solved",
  number: 5,
  difficulty: "3",
  problemId: "p-a",
  bestScore: 92,
  fastestElapsedMs: 83_000,
  fewestMoves: { completionMoveCount: 21, optimalMoveCount: 20 },
  fewestMistakes: 0,
  firstClearedAt: new Date(2026, 9, 30, 12).getTime(),
};

const otherProblem: ZukanProblem = {
  kind: "unsolved",
  number: 6,
  difficulty: "3",
  problemId: "p-b",
  attempted: false,
};

const describeProblem = vi.fn(({ problemId }: ZukanProblem) =>
  problemId === "p-none" ? null : [{ label: "盤面", value: "9×9" }],
);
const renderProblemPreview = vi.fn(({ problemId }: ZukanProblem) => (
  <p>{`${problemId}の盤面`}</p>
));
const onPlay = vi.fn();
const onClose = vi.fn();

function createSelected(
  problem: ZukanProblem,
  previewRef = createRef<HTMLDivElement>(),
) {
  return (
    <ZukanSelectedProblem
      problem={problem}
      numberDigitCount={4}
      describeProblem={describeProblem}
      renderProblemPreview={renderProblemPreview}
      previewRef={previewRef}
      onPlay={onPlay}
      onClose={onClose}
    />
  );
}

function renderSelected(
  ...args: Parameters<typeof createSelected>
): ReturnType<typeof render> {
  return render(createSelected(...args));
}

function getSelected(): HTMLElement {
  return screen.getByRole("complementary", { name: "選んだ問題" });
}

/** 名前と値の組で示した、問題の特徴と解いた問題の値。 */
function listFacts() {
  return within(getSelected())
    .queryAllByRole("term")
    .map((term) => [term.textContent, term.nextSibling?.textContent]);
}

/** 盤面を描く、読み上げず操作も受けない枠。 */
function getPreviewFrame(): HTMLElement {
  const frame = getSelected().querySelector<HTMLElement>("[inert]");
  if (frame === null) {
    throw new Error("盤面を描く枠が無い");
  }
  return frame;
}

/**
 * 要素の CSS の動きが終わったことを知らせる。
 * jsdom は `AnimationEvent` を持たないので、React は接頭辞の付いた名前で動きの終わりを受ける。どちらの名前でも知らせる。
 */
function endAnimation(element: Element) {
  fireEvent.animationEnd(element);
  fireEvent(element, new Event("webkitAnimationEnd", { bubbles: true }));
}

describe("ZukanSelectedProblem", () => {
  beforeEach(() => {
    describeProblem.mockClear();
    renderProblemPreview.mockClear();
    onPlay.mockClear();
    onClose.mockClear();
  });

  describe("解いた問題の場合", () => {
    beforeEach(() => {
      renderSelected(solvedProblem);
    });

    test("番号を全問の桁で示すこと", () => {
      const number = within(getSelected()).getByText("No.0005");

      expect(number).toBeTruthy();
    });

    test("問題の特徴に続けて、最高スコア・最速タイム・最短手数を添えた最少手数・最少ミス・初めてクリアした日を示すこと", () => {
      const facts = listFacts();

      expect(facts).toEqual([
        ["盤面", "9×9"],
        ["最高スコア", "92点"],
        ["最速タイム", "01:23"],
        ["最少手数", "21手（最短 20手）"],
        ["最少ミス", "0回"],
        ["初クリア", "10/30"],
      ]);
    });

    test("難易度を重ねて示さないこと", () => {
      const levelLabel = within(getSelected()).queryByText(/レベル/);

      expect(levelLabel).toBeNull();
    });

    test("その問題の始めたときの盤面を、読み上げず操作も受けない枠の中に描くこと", () => {
      const frame = getPreviewFrame();

      expect(frame.getAttribute("aria-hidden")).toBe("true");
      expect(frame.hasAttribute("inert")).toBe(true);
      expect(within(frame).getByText("p-aの盤面")).toBeTruthy();
    });
  });

  describe("手数もミスも数えないゲームの解いた問題の場合", () => {
    beforeEach(() => {
      renderSelected({
        ...solvedProblem,
        fewestMoves: null,
        fewestMistakes: null,
      });
    });

    test("問題の特徴と、最高スコア・最速タイム・初めてクリアした日だけを示すこと", () => {
      const facts = listFacts();

      expect(facts).toEqual([
        ["盤面", "9×9"],
        ["最高スコア", "92点"],
        ["最速タイム", "01:23"],
        ["初クリア", "10/30"],
      ]);
    });
  });

  describe.each([
    ["途中でやめた問題", true, "挑戦中"],
    ["まだ挑んでいない問題", false, "未挑戦"],
  ] as const)("%sの場合", (_, attempted, statusLabel) => {
    beforeEach(() => {
      renderSelected({ ...otherProblem, attempted });
    });

    test("状態と問題の特徴だけを示し、最高スコアと解いた問題の値を示さないこと", () => {
      const selected = within(getSelected());
      const facts = listFacts();

      expect(selected.getByText(statusLabel)).toBeTruthy();
      expect(selected.queryByText("最高スコア")).toBeNull();
      expect(facts).toEqual([["盤面", "9×9"]]);
    });
  });

  describe("特徴を求められない問題の場合", () => {
    beforeEach(() => {
      renderSelected({ ...otherProblem, problemId: "p-none" });
    });

    test("特徴を示さないこと", () => {
      const facts = listFacts();

      expect(facts).toEqual([]);
    });
  });

  describe("盤面の枠の参照を渡した場合", () => {
    const previewRef = createRef<HTMLDivElement>();

    beforeEach(() => {
      renderSelected(solvedProblem, previewRef);
    });

    test("盤面を描く枠を参照に渡すこと", () => {
      const frame = getPreviewFrame();

      expect(previewRef.current).toBe(frame);
    });
  });

  describe("操作する場合", () => {
    beforeEach(() => {
      renderSelected(solvedProblem);
    });

    test("遊ぶを押すと、遊ぶ操作だけを知らせること", () => {
      fireEvent.click(
        within(getSelected()).getByRole("button", { name: "遊ぶ" }),
      );

      expect(onPlay).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });

    test("閉じるを押すと、閉じる操作だけを知らせること", () => {
      fireEvent.click(
        within(getSelected()).getByRole("button", { name: "閉じる" }),
      );

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onPlay).not.toHaveBeenCalled();
    });

    test("盤面の所を押すと、遊ぶと同じく遊ぶ操作だけを知らせること", () => {
      fireEvent.click(within(getPreviewFrame()).getByText("p-aの盤面"));

      expect(onPlay).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });

    test("ボタンは遊ぶと閉じるの2つだけにし、盤面の所をボタンにしないこと", () => {
      const buttonNames = within(getSelected())
        .getAllByRole("button")
        .map(
          (button) => button.textContent || button.getAttribute("aria-label"),
        );

      expect(buttonNames).toEqual(["閉じる", "遊ぶ"]);
    });
  });

  describe("選ぶ問題を替えた場合", () => {
    let rerender: ReturnType<typeof render>["rerender"];

    beforeEach(() => {
      ({ rerender } = renderSelected(solvedProblem));
      renderProblemPreview.mockClear();
    });

    test("新しい問題の番号と盤面を示し、退いていく前の盤面を枠の中に残すこと", () => {
      rerender(createSelected(otherProblem));
      const frame = within(getPreviewFrame());

      expect(within(getSelected()).getByText("No.0006")).toBeTruthy();
      expect(frame.getByText("p-bの盤面")).toBeTruthy();
      expect(frame.getByText("p-aの盤面")).toBeTruthy();
    });

    test("前の盤面を描き直させず、新しい問題の盤面だけを描かせること", () => {
      rerender(createSelected(otherProblem));
      const renderedProblemIds = new Set(
        renderProblemPreview.mock.calls.map(([{ problemId }]) => problemId),
      );

      expect(renderedProblemIds).toEqual(new Set(["p-b"]));
    });

    test("前の盤面が退き終えると、新しい盤面だけを残すこと", () => {
      rerender(createSelected(otherProblem));
      endAnimation(within(getPreviewFrame()).getByText("p-aの盤面"));
      const frame = within(getPreviewFrame());

      expect(frame.queryByText("p-aの盤面")).toBeNull();
      expect(frame.getByText("p-bの盤面")).toBeTruthy();
    });
  });
});

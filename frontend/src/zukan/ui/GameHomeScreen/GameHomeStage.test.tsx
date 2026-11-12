import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createRef } from "react";

import { GameHomeStage } from "@/zukan/ui/GameHomeScreen/GameHomeStage";
import type { ZukanProblem } from "@/zukan/zukan-collection";

const solvedProblem: ZukanProblem = {
  kind: "solved",
  number: 5,
  difficulty: "3",
  problemId: "p-a",
  bestScore: 92,
  fastestElapsedMs: 83_000,
  fewestMoves: { completionMoveCount: 21, optimalMoveCount: 20 },
  fewestMistakes: 0,
  firstClearedAt: 0,
};
/** 手数もミスも数えないゲームの、解いた問題。 */
const solvedWithoutCountsProblem: ZukanProblem = {
  kind: "solved",
  number: 7,
  difficulty: "3",
  problemId: "p-c",
  bestScore: 70,
  fastestElapsedMs: 3_725_000,
  fewestMoves: null,
  fewestMistakes: null,
  firstClearedAt: 0,
};
const attemptedProblem: ZukanProblem = {
  kind: "unsolved",
  number: 6,
  difficulty: "3",
  problemId: "p-b",
  attempted: true,
};
const untouchedProblem: ZukanProblem = {
  kind: "unsolved",
  number: 8,
  difficulty: "3",
  problemId: "p-d",
  attempted: false,
};
/** 特徴を求められない問題。 */
const undescribedProblem: ZukanProblem = {
  kind: "unsolved",
  number: 9,
  difficulty: "3",
  problemId: "p-e",
  attempted: false,
};

const describeProblem = vi.fn(({ problemId }: ZukanProblem) =>
  problemId === undescribedProblem.problemId
    ? null
    : [
        { label: "盤面", value: "9×9" },
        { label: "初期数字", value: `${problemId.length}個` },
      ],
);
function renderProblemPreview({ problemId }: ZukanProblem) {
  return <p data-play-entry-board="">{`${problemId}の盤面`}</p>;
}
const onPlay = vi.fn();
const onShuffle = vi.fn();

function createStage(problem: ZukanProblem | null) {
  return (
    <GameHomeStage
      problem={problem}
      numberDigitCount={4}
      describeProblem={describeProblem}
      renderProblemPreview={renderProblemPreview}
      previewRef={createRef()}
      shuffleRef={createRef()}
      onPlay={onPlay}
      onShuffle={onShuffle}
    />
  );
}

function getStage(): HTMLElement {
  return screen.getByRole("region", { name: "これから遊ぶ問題" });
}

/** 名前と値の組で示した、問題の値。 */
function listFacts() {
  return within(getStage())
    .queryAllByRole("term")
    .map((term) => [term.textContent, term.nextSibling?.textContent]);
}

/** 盤面を描く、読み上げず操作も受けない枠。 */
function getPreviewFrame(): HTMLElement {
  const frame = getStage().querySelector<HTMLElement>("[inert]");
  if (frame === null) {
    throw new Error("盤面を描く枠が無い");
  }
  return frame;
}

/** 押すと始める、盤面を描く枠を囲む面。 */
function getBoardSurface(): HTMLElement {
  const surface = getPreviewFrame().parentElement;
  if (surface === null) {
    throw new Error("盤面を囲む面が無い");
  }
  return surface;
}

function swipe(from: { x: number; y: number }, to: { x: number; y: number }) {
  const surface = getBoardSurface();
  fireEvent.pointerDown(surface, { clientX: from.x, clientY: from.y });
  fireEvent.pointerUp(surface, { clientX: to.x, clientY: to.y });
  fireEvent.click(surface);
}

beforeEach(() => {
  describeProblem.mockClear();
  onPlay.mockClear();
  onShuffle.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("GameHomeStage", () => {
  describe("問題を渡した場合", () => {
    beforeEach(() => {
      render(createStage(untouchedProblem));
    });

    test("未挑戦であることに続けて、問題の特徴を示すこと", () => {
      const facts = listFacts();

      expect(facts).toEqual([
        ["状態", "未挑戦"],
        ["盤面", "9×9"],
        ["初期数字", "3個"],
      ]);
    });

    test("番号を桁をそろえて示すこと", () => {
      const number = within(getStage()).getByText("No.0008");

      expect(number).toBeTruthy();
    });

    test("始めたときの盤面を、読み上げず操作も受けない枠の中に描くこと", () => {
      const frame = getPreviewFrame();

      expect(frame.getAttribute("aria-hidden")).toBe("true");
      expect(frame.hasAttribute("inert")).toBe(true);
      expect(within(frame).getByText("p-dの盤面")).toBeTruthy();
    });

    test("難易度を示さないこと", () => {
      const levelLabel = within(getStage()).queryByText(/レベル/);

      expect(levelLabel).toBeNull();
    });

    test("遊ぶを押すと、遊ぶと知らせること", () => {
      fireEvent.click(within(getStage()).getByRole("button", { name: "遊ぶ" }));

      expect(onPlay).toHaveBeenCalledTimes(1);
      expect(onShuffle).not.toHaveBeenCalled();
    });

    test("別の問題を押すと、別の問題に替えると知らせること", () => {
      fireEvent.click(
        within(getStage()).getByRole("button", { name: "別の問題" }),
      );

      expect(onShuffle).toHaveBeenCalledTimes(1);
      expect(onPlay).not.toHaveBeenCalled();
    });

    test("盤面を押すと、遊ぶと同じく遊ぶと知らせること", () => {
      swipe({ x: 100, y: 100 }, { x: 103, y: 102 });

      expect(onPlay).toHaveBeenCalledTimes(1);
      expect(onShuffle).not.toHaveBeenCalled();
    });

    test("盤面を横へ払うと、遊ばずに、別の問題に替えると知らせること", () => {
      swipe({ x: 200, y: 100 }, { x: 120, y: 110 });

      expect(onShuffle).toHaveBeenCalledTimes(1);
      expect(onPlay).not.toHaveBeenCalled();
    });

    test("盤面を縦へ動かしても、別の問題に替えず、遊ぶと知らせること", () => {
      swipe({ x: 100, y: 200 }, { x: 130, y: 100 });

      expect(onShuffle).not.toHaveBeenCalled();
      expect(onPlay).toHaveBeenCalledTimes(1);
    });
  });

  describe("問題を替えた場合", () => {
    beforeEach(() => {
      const { rerender } = render(createStage(untouchedProblem));
      rerender(createStage(attemptedProblem));
    });

    test("新しい問題の番号と盤面を示し、前の盤面を消えていく姿で残すこと", () => {
      const number = within(getStage()).getByText("No.0006");
      const board = within(getPreviewFrame()).getByText("p-bの盤面");
      const leaving = getPreviewFrame().querySelector("[data-leaving-preview]");

      expect(number).toBeTruthy();
      expect(board).toBeTruthy();
      expect(leaving?.textContent).toBe("p-dの盤面");
    });

    test("遊ぶを押すと、消えていく前の盤面を除いてから、遊ぶと知らせること", () => {
      fireEvent.click(within(getStage()).getByRole("button", { name: "遊ぶ" }));
      const leaving = getPreviewFrame().querySelector("[data-leaving-preview]");

      expect(leaving).toBeNull();
      expect(onPlay).toHaveBeenCalledTimes(1);
    });
  });

  describe("解いた問題を渡した場合", () => {
    beforeEach(() => {
      render(createStage(solvedProblem));
    });

    test("最高スコアと、最速タイム・最短手数を添えた最少手数・最少ミスを示し、問題の特徴を示さないこと", () => {
      const facts = listFacts();

      expect(facts).toEqual([
        ["最高スコア", "92点"],
        ["最速", "01:23"],
        ["最少", "21手（最短 20手）"],
        ["ミス", "0回"],
      ]);
    });
  });

  describe("手数もミスも数えないゲームの解いた問題を渡した場合", () => {
    beforeEach(() => {
      render(createStage(solvedWithoutCountsProblem));
    });

    test("最高スコアと最速タイムだけを示すこと", () => {
      const facts = listFacts();

      expect(facts).toEqual([
        ["最高スコア", "70点"],
        ["最速", "1:02:05"],
      ]);
    });
  });

  describe("途中でやめた問題を渡した場合", () => {
    beforeEach(() => {
      render(createStage(attemptedProblem));
    });

    test("挑戦中であることに続けて、問題の特徴を示すこと", () => {
      const facts = listFacts();

      expect(facts).toEqual([
        ["状態", "挑戦中"],
        ["盤面", "9×9"],
        ["初期数字", "3個"],
      ]);
    });
  });

  describe("特徴を求められない問題を渡した場合", () => {
    beforeEach(() => {
      render(createStage(undescribedProblem));
    });

    test("未挑戦であることだけを示すこと", () => {
      const facts = listFacts();

      expect(facts).toEqual([["状態", "未挑戦"]]);
    });
  });

  describe("出題できる問題が無い場合", () => {
    beforeEach(() => {
      render(createStage(null));
    });

    test("盤面と番号の代わりに、出題の条件に合う問題が無いことを示すこと", () => {
      const notice = within(getPreviewFrame()).getByText(
        "出題の条件に合う問題がありません",
      );
      const number = within(getStage()).queryByText(/^No\./);

      expect(notice).toBeTruthy();
      expect(number).toBeNull();
    });

    test("遊ぶと別の問題を押せるままにし、押すとそれぞれ知らせること", () => {
      const playButton = within(getStage()).getByRole("button", {
        name: "遊ぶ",
      });
      const shuffleButton = within(getStage()).getByRole("button", {
        name: "別の問題",
      });

      fireEvent.click(playButton);
      fireEvent.click(shuffleButton);

      expect(playButton.hasAttribute("disabled")).toBe(false);
      expect(shuffleButton.hasAttribute("disabled")).toBe(false);
      expect(onPlay).toHaveBeenCalledTimes(1);
      expect(onShuffle).toHaveBeenCalledTimes(1);
    });
  });
});

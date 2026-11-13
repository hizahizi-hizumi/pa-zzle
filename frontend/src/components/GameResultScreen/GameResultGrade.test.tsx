import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { GameResultGrade } from "@/components/GameResultScreen/GameResultGrade";
import { ResultEmblemContext } from "@/components/GameResultScreen/result-emblem";
import { getGameResultLevel } from "@/games/result";

const grade = {
  level: getGameResultLevel(91),
  score: 91,
  countUp: true,
} as const;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("GameResultGrade の得点演出", () => {
  let container: HTMLElement;
  let rerender: ReturnType<typeof render>["rerender"];

  beforeEach(() => {
    ({ container, rerender } = render(<GameResultGrade {...grade} />));
  });

  test("得点が変化している間も正しい評価点を読めること", () => {
    const scoreLabel = screen.getByText("91点（100点満点）");
    const animatedNumber = screen.getByText("0");

    expect(scoreLabel).toBeTruthy();
    expect(animatedNumber.getAttribute("aria-hidden")).toBe("true");
  });

  test("到達した点数の割合をグラフィックで示すこと", () => {
    const fill = container.querySelector(
      ".result-grade-progress-fill",
    ) as HTMLElement;

    expect(fill.style.width).toBe("91%");
    expect(container.querySelector(".result-grade-complete")).toBeNull();
  });

  test("演出をスキップすると途中の点数を残さず最終得点になること", () => {
    rerender(<GameResultGrade {...grade} countUp={false} />);

    expect(screen.getByText("91")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });
});

describe("GameResultGrade の動きを減らす設定", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    render(<GameResultGrade {...grade} />);
  });

  test("最初から最終得点を表示すること", () => {
    const score = screen.getByText("91");

    expect(score).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });
});

describe("GameResultGrade に添える姿", () => {
  describe("解いた問題の姿が渡されている場合", () => {
    beforeEach(() => {
      render(
        <ResultEmblemContext value={<span>解いた問題の姿</span>}>
          <GameResultGrade {...grade} />
        </ResultEmblemContext>,
      );
    });

    test("評価の言葉の前に、渡された姿を添えること", () => {
      const emblem = screen.getByText("解いた問題の姿");
      const gradeName = screen.getByText("すばらしい！");

      expect(
        emblem.compareDocumentPosition(gradeName) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  describe("解いた問題の姿が渡されていない場合", () => {
    let container: HTMLElement;

    beforeEach(() => {
      ({ container } = render(<GameResultGrade {...grade} />));
    });

    test("姿を置く場所を作らないこと", () => {
      const emblem = container.querySelector("[data-result-emblem]");

      expect(emblem).toBeNull();
    });
  });
});

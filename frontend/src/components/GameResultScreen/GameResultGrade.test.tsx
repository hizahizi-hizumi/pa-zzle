import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { GameResultGrade } from "@/components/GameResultScreen/GameResultGrade";
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

describe("GameResultGrade の評価の言葉", () => {
  describe("clear の場合", () => {
    beforeEach(() => {
      render(<GameResultGrade level="clear" score={74} />);
    });

    test("褒める言葉を出し、図鑑と同じ評価段階の名前を添えること", () => {
      const message = screen.getByText("クリア！");
      const levelName = screen.getByLabelText("評価 clear");

      expect(message).toBeTruthy();
      expect(levelName.textContent).toBe("clear");
    });
  });

  describe("称号を渡した場合", () => {
    beforeEach(() => {
      render(
        <GameResultGrade
          level="good"
          score={86}
          feats={["ノーミス！", "待ったなし！"]}
        />,
      );
    });

    test("評価の言葉と同じまとまりに称号を出すこと", () => {
      const grade = screen.getByRole("region", { name: "スコア" });

      expect(within(grade).getByText("ナイスプレイ！")).toBeTruthy();
      expect(within(grade).getByText("ノーミス！")).toBeTruthy();
      expect(within(grade).getByText("待ったなし！")).toBeTruthy();
    });
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { Issue690Grade } from "@/components/Issue690Grade";
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

describe("Issue690Grade の得点演出", () => {
  test("得点が変化している間も正しい評価点を読めること", () => {
    render(<Issue690Grade {...grade} />);

    const scoreLabel = screen.getByText("91点（100点満点）");
    const animatedNumber = screen.getByText("0");

    expect(scoreLabel).toBeTruthy();
    expect(animatedNumber.getAttribute("aria-hidden")).toBe("true");
  });

  test("動きを減らす設定では最初から最終得点を表示すること", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));

    render(<Issue690Grade {...grade} />);

    expect(screen.getByText("91")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });
});

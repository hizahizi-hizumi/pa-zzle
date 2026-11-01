import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router";

import {
  openRecordProblemPlay,
  useGameNavigation,
} from "@/game-catalog/game-navigation";
import { useNavigate } from "@/router";

const game = {
  homePath: "/puzzles/minesweeper",
  playPath: "/puzzles/minesweeper/play/:difficulty",
} as const;

function RouterWrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/puzzles/minesweeper/play/1"]}>
      {children}
    </MemoryRouter>
  );
}

function useNavigationWithLocation() {
  return {
    navigation: useGameNavigation(game),
    navigate: useNavigate(),
    location: useLocation(),
    navigationType: useNavigationType(),
  };
}

describe("useGameNavigation", () => {
  let result: { current: ReturnType<typeof useNavigationWithLocation> };

  beforeEach(() => {
    ({ result } = renderHook(useNavigationWithLocation, {
      wrapper: RouterWrapper,
    }));
  });

  test("backToHome で / へ移ること", () => {
    act(() => result.current.navigation.backToHome());

    const { pathname } = result.current.location;

    expect(pathname).toBe("/");
  });

  test("openGameHome でゲームのホームへ移ること", () => {
    act(() => result.current.navigation.openGameHome());

    const { pathname, search } = result.current.location;

    expect(pathname).toBe("/puzzles/minesweeper");
    expect(search).toBe("");
  });

  test("openGameHome に問題 ID を渡すと、その問題 ID を URL に載せたゲームのホームへ移ること", () => {
    act(() => result.current.navigation.openGameHome("problem-1"));

    const { pathname, search } = result.current.location;

    expect(pathname).toBe("/puzzles/minesweeper");
    expect(search).toBe("?problem=problem-1");
  });

  test("openGameHome は、履歴に積んでゲームのホームへ移ること", () => {
    act(() => result.current.navigation.openGameHome("problem-1"));

    const { navigationType } = result.current;

    expect(navigationType).toBe("PUSH");
  });

  test("openGameHome に replacesHistory を渡すと、今の画面の履歴を置き換えてゲームのホームへ移ること", () => {
    act(() =>
      result.current.navigation.openGameHome("problem-1", {
        replacesHistory: true,
      }),
    );

    const { location, navigationType } = result.current;

    expect(location.search).toBe("?problem=problem-1");
    expect(navigationType).toBe("REPLACE");
  });

  test("startNewProblem で難易度のプレイ画面を開き、避ける問題の ID を state に渡すこと", () => {
    act(() => result.current.navigation.startNewProblem("3", "problem-1"));

    const { pathname, state } = result.current.location;

    expect(pathname).toBe("/puzzles/minesweeper/play/3");
    expect(state).toEqual({ avoidedProblemId: "problem-1" });
  });
});

describe("openRecordProblemPlay", () => {
  let result: { current: ReturnType<typeof useNavigationWithLocation> };

  beforeEach(() => {
    ({ result } = renderHook(useNavigationWithLocation, {
      wrapper: RouterWrapper,
    }));
  });

  test("記録の難易度のプレイ画面を、問題 ID を URL に載せて開くこと", () => {
    act(() =>
      openRecordProblemPlay(result.current.navigate, {
        playPath: game.playPath,
        difficulty: "2",
        problemId: "problem-1",
      }),
    );

    const { pathname, search } = result.current.location;

    expect(pathname).toBe("/puzzles/minesweeper/play/2");
    expect(search).toBe("?problem=problem-1");
  });
});

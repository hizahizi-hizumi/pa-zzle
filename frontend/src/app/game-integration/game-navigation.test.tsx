import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router";

import {
  openRecordProblemPlay,
  useGameNavigation,
} from "@/app/game-integration/game-navigation";
import { minesweeperCatalogEntry } from "@/app/game-integration/minesweeper/minesweeper-catalog-entry";
import { useNavigate } from "@/router";

const game = minesweeperCatalogEntry;

type RouterWrapperProps = { children: ReactNode };

function RouterWrapper({ children }: RouterWrapperProps) {
  return (
    <MemoryRouter initialEntries={["/puzzles/minesweeper/play/p1"]}>
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

  test("backToAppHome で / へ移ること", () => {
    act(() => result.current.navigation.backToAppHome());

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

  test("startNewProblem で難易度のプレイ画面を開き、別の問題の ID を URL に載せること", () => {
    act(() => result.current.navigation.startNewProblem("3", "problem-1"));

    const { pathname, search } = result.current.location;

    expect(pathname.startsWith("/puzzles/minesweeper/play/")).toBe(true);
    expect(game.listPoolProblemIds("3")).toContain(pathname.split("/").at(-1));
    expect(search).toBe("");
    expect(result.current.navigationType).toBe("PUSH");
  });

  test("プレイ中の別の問題では履歴を置き換えること", () => {
    act(() =>
      result.current.navigation.startNewProblem("3", "problem-1", {
        replacesHistory: true,
      }),
    );
    expect(result.current.navigationType).toBe("REPLACE");
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

    expect(pathname).toBe("/puzzles/minesweeper/play/problem-1");
    expect(search).toBe("");
  });
});

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";

import {
  openRecordProblemPlay,
  useGameNavigation,
} from "@/game-catalog/game-navigation";
import { useNavigate } from "@/router";

const game = {
  entryPath: "/puzzles/minesweeper",
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
  };
}

describe("useGameNavigation", () => {
  let result: { current: ReturnType<typeof useNavigationWithLocation> };

  beforeEach(() => {
    ({ result } = renderHook(useNavigationWithLocation, {
      wrapper: RouterWrapper,
    }));
  });

  const pathCases = [
    ["openRecords", "/records"],
    ["changeDifficulty", "/puzzles/minesweeper"],
    ["backToHome", "/"],
  ] as const;

  test.each(pathCases)("%s で %s へ移ること", (operation, path) => {
    act(() => result.current.navigation[operation]());

    const { pathname } = result.current.location;

    expect(pathname).toBe(path);
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

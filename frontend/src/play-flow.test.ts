import { expect, test } from "vitest";
import { initialPlayFlowState, playFlowReducer } from "./play-flow";

test("ゲーム選択からクリア結果まで一連の状態を遷移できること", () => {
  const gameSelected = playFlowReducer(initialPlayFlowState, {
    type: "select-game",
    gameId: "water-sort",
  });
  const difficultySelected = playFlowReducer(gameSelected, {
    type: "select-difficulty",
    difficulty: "hard",
  });
  const cleared = playFlowReducer(difficultySelected, {
    type: "clear-game",
    result: { status: "cleared" },
  });

  expect(cleared).toEqual({
    screen: "result",
    gameId: "water-sort",
    difficulty: "hard",
    result: { status: "cleared" },
  });
});

test("成績表示から同じゲームと難易度でもう一度プレイできること", () => {
  const resultState = {
    screen: "result" as const,
    gameId: "sudoku" as const,
    difficulty: "normal" as const,
    result: { status: "cleared" as const },
  };

  const replaying = playFlowReducer(resultState, { type: "play-again" });

  expect(replaying).toEqual({
    screen: "playing",
    gameId: "sudoku",
    difficulty: "normal",
  });
});

test("プレイ画面から難易度選択へ戻れること", () => {
  const playingState = {
    screen: "playing" as const,
    gameId: "sudoku" as const,
    difficulty: "easy" as const,
  };

  const difficultySelection = playFlowReducer(playingState, {
    type: "back-to-difficulties",
  });

  expect(difficultySelection).toEqual({
    screen: "difficulty-selection",
    gameId: "sudoku",
  });
});

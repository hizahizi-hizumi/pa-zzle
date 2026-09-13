export type GameId = "water-sort" | "sudoku";
export type DifficultyId = "easy" | "normal" | "hard";

export type GameSessionResult = {
  status: "cleared";
};

export type PlayFlowState =
  | { screen: "game-selection" }
  | { screen: "difficulty-selection"; gameId: GameId }
  | { screen: "playing"; gameId: GameId; difficulty: DifficultyId }
  | {
      screen: "result";
      gameId: GameId;
      difficulty: DifficultyId;
      result: GameSessionResult;
    };

export type PlayFlowAction =
  | { type: "select-game"; gameId: GameId }
  | { type: "select-difficulty"; difficulty: DifficultyId }
  | { type: "back-to-games" }
  | { type: "back-to-difficulties" }
  | { type: "clear-game"; result: GameSessionResult }
  | { type: "play-again" };

export const initialPlayFlowState: PlayFlowState = {
  screen: "game-selection",
};

export function playFlowReducer(
  state: PlayFlowState,
  action: PlayFlowAction,
): PlayFlowState {
  switch (action.type) {
    case "select-game":
      return { screen: "difficulty-selection", gameId: action.gameId };
    case "select-difficulty":
      if (state.screen !== "difficulty-selection") {
        return state;
      }
      return {
        screen: "playing",
        gameId: state.gameId,
        difficulty: action.difficulty,
      };
    case "back-to-games":
      return initialPlayFlowState;
    case "back-to-difficulties":
      if (state.screen !== "playing") {
        return state;
      }
      return { screen: "difficulty-selection", gameId: state.gameId };
    case "clear-game":
      if (state.screen !== "playing") {
        return state;
      }
      return {
        screen: "result",
        gameId: state.gameId,
        difficulty: state.difficulty,
        result: action.result,
      };
    case "play-again":
      if (state.screen !== "result") {
        return state;
      }
      return {
        screen: "playing",
        gameId: state.gameId,
        difficulty: state.difficulty,
      };
  }
}

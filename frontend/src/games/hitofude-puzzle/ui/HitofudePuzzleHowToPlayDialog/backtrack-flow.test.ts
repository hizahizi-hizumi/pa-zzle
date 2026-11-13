import { playHitofudePuzzleBacktrackFlow } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/backtrack-flow";
import { backtrackFlows } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/figure-boards";

describe("playHitofudePuzzleBacktrackFlow", () => {
  test.each([
    [
      "same",
      {
        frames: [
          { path: [0, 1, 3], pressedCell: null, addedBacktracks: 0 },
          { path: [0, 1], pressedCell: 1, addedBacktracks: 0 },
          { path: [0, 1, 3], pressedCell: null, addedBacktracks: 0 },
        ],
        backtrackCount: 0,
      },
    ],
    [
      "different",
      {
        frames: [
          { path: [0, 1, 3], pressedCell: null, addedBacktracks: 0 },
          { path: [0], pressedCell: 0, addedBacktracks: 0 },
          { path: [0, 2], pressedCell: null, addedBacktracks: 1 },
        ],
        backtrackCount: 1,
      },
    ],
    [
      "undo",
      {
        frames: [
          { path: [0, 1, 3], pressedCell: null, addedBacktracks: 0 },
          { path: [0, 2], pressedCell: 0, addedBacktracks: 1 },
          { path: [0, 1, 3], pressedCell: null, addedBacktracks: 1 },
        ],
        backtrackCount: 2,
      },
    ],
  ] as const)(
    "%s の流れを本番の session で打ったコマ（押したマスと、その操作で増えた引き直し）と、引き直しの回数を返すこと",
    (flow, expected) => {
      const figure = playHitofudePuzzleBacktrackFlow(backtrackFlows[flow]);

      expect(figure).toEqual(expected);
    },
  );
});

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
} from "@/games/slide-puzzle/puzzle/rules";
import type { SlidePuzzleBoard } from "@/games/slide-puzzle/puzzle/state";
import { goalFigure } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/figure-boards";
import {
  _private,
  GoalPlayback,
} from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/GoalPlayback";
import { playLayeredSound, playSound } from "@/lib/audio/sound-effects";
import { prefersReducedMotion } from "@/lib/motion";

vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion")>()),
  prefersReducedMotion: vi.fn(() => false),
}));

vi.mock("@/lib/audio/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

const { GOAL_START_HOLD_MS, GOAL_SLIDE_INTERVAL_MS, goalOperations } = _private;

/** 終わらないクリアの波。完了は、波を返し終えたことを待つ間に飛ばす操作で確かめる。 */
const animate = vi.fn(function createFinishedAnimation(): Animation {
  return {
    finished: Promise.resolve(),
    cancel: vi.fn(),
  } as unknown as Animation;
});

/** 始まりの盤面から、本番の遷移で `count` 手スライドさせた盤面。 */
function slideGoalTiles(count: number): SlidePuzzleBoard {
  return goalFigure.tappedTiles
    .slice(0, count)
    .reduce<SlidePuzzleBoard>((board, tile) => {
      const slide = getSlidePuzzleSlide(board, board.indexOf(tile));
      return slide === null ? board : applySlidePuzzleSlide(board, slide);
    }, goalFigure.start);
}

function readGoalBoard(): number[] {
  const tiles = within(
    screen.getByRole("img", { name: "ゴールの盤面" }),
  ).getAllByRole("button", { hidden: true });
  const board = Array.from({ length: tiles.length + 1 }, () => 0);
  for (const tile of tiles) {
    const [column = 0, row = 0] = (
      tile.style.transform.match(/\d+/g) ?? []
    ).map((value) => Number(value) / 100);
    board[row * 3 + column] = Number(tile.textContent);
  }
  return board;
}

function getReplayButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "始まりの盤面から見せ直す",
  });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const stepCount = goalFigure.tappedTiles.length;
const lastStepAt =
  GOAL_START_HOLD_MS + (stepCount - 1) * GOAL_SLIDE_INTERVAL_MS;

beforeEach(() => {
  vi.useFakeTimers();
  animate.mockClear();
  Element.prototype.animate = animate as unknown as Element["animate"];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(prefersReducedMotion).mockReturnValue(false);
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
  Reflect.deleteProperty(Element.prototype, "animate");
});

describe("GoalPlayback", () => {
  const solvedBoard = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  const firstBoards = [0, 1, 2].map(slideGoalTiles);

  describe("動きを減らさない設定の場合", () => {
    beforeEach(() => {
      render(<GoalPlayback />);
    });

    test("始まりの盤面を見せてから、本番の遷移で1手ずつスライドさせること", async () => {
      const boards = [readGoalBoard()];
      await advance(GOAL_START_HOLD_MS);
      boards.push(readGoalBoard());
      await advance(GOAL_SLIDE_INTERVAL_MS);
      boards.push(readGoalBoard());

      expect(boards).toEqual(firstBoards);
    });

    test("最後の手で完成し、本番のクリアの波を返し終えてから見せ直すボタンを出し、音は鳴らさないこと", async () => {
      await advance(lastStepAt);
      const disabledBeforeClear = getReplayButton().disabled;
      await advance(1000);

      const board = readGoalBoard();
      const disabledAfterClear = getReplayButton().disabled;

      expect(board).toEqual(solvedBoard);
      expect(animate).toHaveBeenCalledTimes(8);
      expect(disabledBeforeClear).toBe(true);
      expect(disabledAfterClear).toBe(false);
      expect(playSound).not.toHaveBeenCalled();
      expect(playLayeredSound).not.toHaveBeenCalled();
    });

    test("並べている途中に盤面を押すと、完成した姿へ飛ばして見せ直すボタンを出すこと", async () => {
      await advance(GOAL_START_HOLD_MS);
      fireEvent.click(screen.getByLabelText("完成した姿まで飛ばす"));

      const board = readGoalBoard();
      const disabled = getReplayButton().disabled;

      expect(board).toEqual(solvedBoard);
      expect(animate).not.toHaveBeenCalled();
      expect(disabled).toBe(false);
    });

    test("見せ直すボタンで、始まりの盤面からもう一度並べること", async () => {
      await advance(lastStepAt);
      await advance(1000);
      fireEvent.click(getReplayButton());
      const restarted = readGoalBoard();
      await advance(GOAL_START_HOLD_MS);

      const board = readGoalBoard();

      expect(restarted).toEqual(firstBoards[0]);
      expect(board).toEqual(firstBoards[1]);
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.mocked(prefersReducedMotion).mockReturnValue(true);
      render(<GoalPlayback />);
    });

    test("始まりの盤面を見せてから、完成した盤面を動かさずに見せること", async () => {
      const start = readGoalBoard();
      await advance(GOAL_START_HOLD_MS);

      const board = readGoalBoard();
      const disabled = getReplayButton().disabled;

      expect(start).toEqual(firstBoards[0]);
      expect(board).toEqual(solvedBoard);
      expect(animate).not.toHaveBeenCalled();
      expect(disabled).toBe(false);
    });
  });
});

describe("goalOperations", () => {
  const boardsAfterEachStep = goalFigure.tappedTiles.map((_, index) =>
    slideGoalTiles(index + 1),
  );
  const lastStepOnly = goalFigure.tappedTiles.map(
    (_, index) => index === stepCount - 1,
  );

  test("どの手も本番のスライドの知らせで、最後の手だけを完成させる手とすること", () => {
    const clearing = goalOperations.map(({ isClearingMove }) => isClearingMove);
    const boards = goalOperations.map(({ boardAfter }) => boardAfter);

    expect(clearing).toEqual(lastStepOnly);
    expect(boards).toEqual(boardsAfterEachStep);
  });
});

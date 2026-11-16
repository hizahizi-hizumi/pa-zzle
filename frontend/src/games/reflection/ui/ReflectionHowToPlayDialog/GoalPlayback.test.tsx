import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { reflectionPieceLabels } from "@/games/reflection/ui/piece-label";
import { goalFigure } from "@/games/reflection/ui/ReflectionHowToPlayDialog/figure-boards";
import {
  _private,
  GoalPlayback,
} from "@/games/reflection/ui/ReflectionHowToPlayDialog/GoalPlayback";
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

const { GOAL_START_HOLD_MS, GOAL_PLACE_INTERVAL_MS, placeGoalPieces } =
  _private;

const pieceCount = goalFigure.order.length;

/** ゴールの盤面に置いてあるピースの数。本番の盤面部品で描くので、マスの読み上げ名で数える。 */
function countPlacedPieces(): number {
  const labels = Object.values(reflectionPieceLabels);
  return within(screen.getByRole("img", { name: "ゴールの盤面" }))
    .getAllByRole("button", { hidden: true })
    .filter((button) =>
      labels.some((label) =>
        button.getAttribute("aria-label")?.endsWith(` ${label}`),
      ),
    ).length;
}

function getReplayButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "始まりの盤面から見せ直す",
    hidden: true,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(prefersReducedMotion).mockReturnValue(false);
});

describe("placeGoalPieces", () => {
  test("置く順の先頭から数えたマスにだけ、解き終えた盤面のピースを置くこと", () => {
    const board = placeGoalPieces(2);

    const placed = board.cells.flatMap((cell, index) =>
      cell === null ? [] : [index],
    );

    expect(placed).toEqual(
      [...goalFigure.order.slice(0, 2)].sort((a, b) => a - b),
    );
  });
});

describe("GoalPlayback", () => {
  describe("開いた直後の場合", () => {
    beforeEach(() => {
      render(<GoalPlayback />);
    });

    test("外周の数字だけの空の盤面を見せること", () => {
      const placed = countPlacedPieces();

      expect(placed).toBe(0);
    });

    test("見せ直すボタンを出さないこと", () => {
      const button = getReplayButton();

      expect(button.disabled).toBe(true);
    });
  });

  describe("時間が進んだ場合", () => {
    beforeEach(() => {
      render(<GoalPlayback />);
    });

    test("ピースを1つずつ置いていくこと", () => {
      act(() => {
        vi.advanceTimersByTime(GOAL_START_HOLD_MS + GOAL_PLACE_INTERVAL_MS);
      });

      const placed = countPlacedPieces();

      expect(placed).toBe(2);
    });

    test("置き終えて完成の演出を終えたら、見せ直すボタンを出し、音は鳴らさないこと", () => {
      act(() => {
        vi.advanceTimersByTime(
          GOAL_START_HOLD_MS + pieceCount * GOAL_PLACE_INTERVAL_MS + 3000,
        );
      });

      const button = getReplayButton();

      expect(countPlacedPieces()).toBe(pieceCount);
      expect(button.disabled).toBe(false);
      expect(playSound).not.toHaveBeenCalled();
      expect(playLayeredSound).not.toHaveBeenCalled();
    });
  });

  describe("置いている途中に盤面を押した場合", () => {
    beforeEach(() => {
      render(<GoalPlayback />);
      act(() => {
        vi.advanceTimersByTime(GOAL_START_HOLD_MS);
      });
    });

    test("残りを飛ばして、すべて置いた姿を見せること", () => {
      fireEvent.click(screen.getByLabelText("置き終えた姿まで飛ばす"));

      const placed = countPlacedPieces();

      expect(placed).toBe(pieceCount);
      expect(getReplayButton().disabled).toBe(false);
    });
  });

  describe("見せ直した場合", () => {
    beforeEach(() => {
      render(<GoalPlayback />);
      fireEvent.click(screen.getByLabelText("置き終えた姿まで飛ばす"));
    });

    test("空の盤面からもう一度置いていくこと", () => {
      fireEvent.click(getReplayButton());

      const placed = countPlacedPieces();

      expect(placed).toBe(0);
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.mocked(prefersReducedMotion).mockReturnValue(true);
      render(<GoalPlayback />);
    });

    test("始まりの盤面を見せた後、1つずつ置かずにすべて置いた姿を見せること", () => {
      act(() => {
        vi.advanceTimersByTime(GOAL_START_HOLD_MS);
      });

      const placed = countPlacedPieces();

      expect(placed).toBe(pieceCount);
      expect(getReplayButton().disabled).toBe(false);
    });
  });
});

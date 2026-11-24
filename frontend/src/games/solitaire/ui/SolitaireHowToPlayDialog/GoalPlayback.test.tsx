import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { goalFigure } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/figure-boards";
import {
  _private,
  GoalPlayback,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/GoalPlayback";
import { prefersReducedMotion } from "@/lib/motion";

vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion")>()),
  prefersReducedMotion: vi.fn(() => false),
}));

const { GOAL_START_HOLD_MS, GOAL_MOVE_INTERVAL_MS, getMoveOperation } =
  _private;

const moveCount = goalFigure.moves.length;

/** 最後の札を動かし始めるまで。 */
const lastMoveAtMs =
  GOAL_START_HOLD_MS + (moveCount - 1) * GOAL_MOVE_INTERVAL_MS;

/** 盤面に描かれた組札。本番の盤面部品で描くので、本番と同じ読み上げ名を持つ。 */
function readFoundations(): (string | null)[] {
  return within(screen.getByRole("img", { name: "ゴールの盤面" }))
    .getAllByRole("button", { name: /の組札、/ })
    .map((button) => button.getAttribute("aria-label"));
}

const startFoundations = [
  "♠の組札、♠J",
  "♥の組札、♥J",
  "♦の組札、♦J",
  "♣の組札、♣J",
];
const goalFoundations = [
  "♠の組札、♠K",
  "♥の組札、♥K",
  "♦の組札、♦K",
  "♣の組札、♣K",
];

function getReplayButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "始まりの盤面から見せ直す",
  });
}

/** 運んでいる途中にだけ盤面に重ねる、最後の姿まで飛ばす所。読み上げには出さないので、名前で探す。 */
function querySkipTarget(): HTMLElement | null {
  return screen.queryByLabelText("運び終えた姿まで飛ばす");
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(prefersReducedMotion).mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("GoalPlayback", () => {
  describe("開いた場合", () => {
    beforeEach(() => {
      render(<GoalPlayback />);
    });

    test("始まりの盤面を見せ、見せ直すボタンはまだ使えないこと", () => {
      const foundations = readFoundations();

      expect(foundations).toEqual(startFoundations);
      expect(getReplayButton().disabled).toBe(true);
    });

    test("1枚ずつ運び、最後の札を運ぶと組札がどれも K になること", () => {
      advance(GOAL_START_HOLD_MS);
      const afterFirst = readFoundations();

      advance(lastMoveAtMs - GOAL_START_HOLD_MS);

      expect(afterFirst).toEqual([
        "♠の組札、♠J",
        "♥の組札、♥Q",
        "♦の組札、♦J",
        "♣の組札、♣J",
      ]);
      expect(readFoundations()).toEqual(goalFoundations);
    });

    test("クリアの動きを終えると、見せ直すボタンを使えるようにし、押すと始まりの盤面に戻すこと", () => {
      advance(lastMoveAtMs);
      advance(5_000);

      fireEvent.click(getReplayButton());

      expect(readFoundations()).toEqual(startFoundations);
      expect(querySkipTarget()).not.toBeNull();
    });

    test("途中で盤面を押すと、運び終えた姿へ飛ばすこと", () => {
      advance(GOAL_START_HOLD_MS);

      fireEvent.click(querySkipTarget()!);

      expect(readFoundations()).toEqual(goalFoundations);
      expect(getReplayButton().disabled).toBe(false);
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.mocked(prefersReducedMotion).mockReturnValue(true);
      render(<GoalPlayback />);
    });

    test("始まりの盤面を見せてから、運び終えた姿を動かさずに見せること", () => {
      advance(GOAL_START_HOLD_MS);

      expect(readFoundations()).toEqual(goalFoundations);
      expect(getReplayButton().disabled).toBe(false);
    });
  });

  describe("getMoveOperation", () => {
    test("最後の手だけをクリアの手として知らせること", () => {
      const operations = goalFigure.moves.map((_, index) =>
        getMoveOperation(index + 1, 0),
      );

      expect(
        operations.map((operation) =>
          operation?.type === "moved" ? operation.isClearingMove : null,
        ),
      ).toEqual([...Array(moveCount - 1).fill(false), true]);
    });
  });
});

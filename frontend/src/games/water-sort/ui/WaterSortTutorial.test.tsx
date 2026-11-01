import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { WaterSortTutorial } from "@/games/water-sort/ui/WaterSortTutorial";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
  REPEATED_SOUND_VARIATION: {},
}));

/** 手順ごとに、注ぎ元、注ぎ先の順に印を付けるボトル（1始まり）。 */
const stepBottles = [
  [2, 4],
  [3, 4],
  [1, 4],
] as const;

/** 手順を終えた後、同じ色を重ねていってそろえるボトル（1始まり）。 */
const remainingBottles = [3, 1, 2, 3, 2, 1] as const;

/** 印の無いボトルを押されてから、強めた印を元の印に戻すまでの間。 */
const hintAgainMs = 600;

/** 手を離した後、手が止まってから次のボトルを示すまでの間。 */
const idleHintDelayMs = 4000;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

function advanceTime(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function getScreen(): HTMLElement {
  return screen.getByRole("dialog", { name: "ウォーターソート" });
}

function getBottle(bottleNumber: number): HTMLElement {
  return within(getScreen()).getByRole("button", {
    name: new RegExp(`^ボトル ${bottleNumber}:`),
  });
}

function tapBottles(bottleNumbers: readonly number[]): void {
  for (const bottleNumber of bottleNumbers) {
    fireEvent.click(getBottle(bottleNumber));
  }
}

/** 導入を飛ばして、最初の手順から始める。 */
function skipIntro(): void {
  fireEvent.pointerDown(getBottle(1));
}

/** 印を付けているボトル（1始まり）。 */
function getHintedBottles(kind: "hint" | "hint-again" = "hint"): number[] {
  return [1, 2, 3, 4, 5].filter((bottleNumber) =>
    getBottle(bottleNumber).querySelector(`[data-bottle-cue="${kind}"]`),
  );
}

function getRuleTexts(): string[] {
  return within(screen.getByRole("list", { name: "ルール" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("WaterSortTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let onStartPlay: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    onStartPlay = vi.fn<() => void>();
  });

  describe("難易度選択から開いた場合", () => {
    beforeEach(() => {
      render(
        <WaterSortTutorial
          open={true}
          onStartPlay={onStartPlay}
          onClose={onClose}
        />,
      );
      skipIntro();
    });

    test("色の混ざった始めの盤面で、注ぎ元に印を付け、まだ示していないルールを伏せておくこと", () => {
      const headline = screen.getByText(
        "ボトルをタップして選び 注ぐ先をタップします",
      );
      const firstBottle = getBottle(1).getAttribute("aria-label");
      const hinted = getHintedBottles();
      const rules = getRuleTexts();

      expect(headline).toBeTruthy();
      expect(firstBottle).toBe("ボトル 1: 赤、赤、青、青");
      expect(hinted).toEqual([2]);
      expect(rules).toEqual(["伏せたルール", "伏せたルール"]);
    });

    test("印の無いボトルを押しても、選ばずに、一言を変えずに印を強めて光らせ直すこと", () => {
      tapBottles([1]);

      const pressed = getBottle(1).getAttribute("aria-pressed");
      const headline = screen.getByText(
        "ボトルをタップして選び 注ぐ先をタップします",
      );
      const hintedAgain = getHintedBottles("hint-again");

      expect(pressed).toBe("false");
      expect(headline).toBeTruthy();
      expect(hintedAgain).toEqual([2]);
      expect(playSound).not.toHaveBeenCalled();
    });

    test("光らせ直した印を、少しして元の印に戻すこと", () => {
      tapBottles([1]);
      advanceTime(hintAgainMs);

      const hinted = getHintedBottles();

      expect(hinted).toEqual([2]);
    });

    test("印のボトルを選ぶと、注ぐ先に印を移すこと", () => {
      tapBottles([2]);

      const pressed = getBottle(2).getAttribute("aria-pressed");
      const hinted = getHintedBottles();

      expect(pressed).toBe("true");
      expect(hinted).toEqual([4]);
    });

    test("印のとおりに注ぐと、注いで、注げる先のルールを示す手順へ進むこと", () => {
      tapBottles(stepBottles[0]);

      const destination = getBottle(4).getAttribute("aria-label");
      const headline = screen.getByText(
        "注げるのは、空のボトルか 同じ色の上だけです",
      );
      const hinted = getHintedBottles();
      const rules = getRuleTexts();

      expect(destination).toBe("ボトル 4: 青");
      expect(playLayeredSound).toHaveBeenCalledTimes(1);
      expect(headline).toBeTruthy();
      expect(hinted).toEqual([3]);
      expect(rules).toEqual(["空か同じ色の上に注ぐ", "伏せたルール"]);
    });

    describe("注げる先のルールを示す手順で注ぎ元を選んだ場合", () => {
      beforeEach(() => {
        tapBottles([...stepBottles[0], stepBottles[1][0]]);
      });

      test("違う色の上を押すと、注がずに、注げないわけを言うこと", () => {
        tapBottles([2]);

        const source = getBottle(3).getAttribute("aria-label");
        const headline = screen.getByText("違う色の上には注げません");

        expect(source).toBe("ボトル 3: 緑、緑、赤、青");
        expect(headline).toBeTruthy();
      });
    });

    describe("手順をすべて終えた場合", () => {
      beforeEach(() => {
        tapBottles(stepBottles.flat());
      });

      test("青がそろい、手を離して残りをそろえる一言にすること", () => {
        const blue = getBottle(4).getAttribute("aria-label");
        const headline = screen.getByText("残りの色もそろえると完成です");
        const hinted = getHintedBottles();
        const rules = getRuleTexts();

        expect(blue).toBe("ボトル 4: 青、青、青、青");
        expect(headline).toBeTruthy();
        expect(hinted).toEqual([]);
        expect(rules).toEqual(["空か同じ色の上に注ぐ", "同じ色はまとめて移る"]);
      });

      test.each([
        ["そろったボトル", [4], "そろったボトルは、もう動かせません"],
        ["空のボトル", [5], "空のボトルからは注げません"],
        ["違う色の上", [1, 2], "違う色の上には注げません"],
      ] as const)(
        "本番で通らない手に、わけを言うこと: %s",
        (_name, bottleNumbers, expected) => {
          tapBottles(bottleNumbers);

          const headline = screen.getByText(expected);

          expect(headline).toBeTruthy();
        },
      );

      test("手が止まると、次に注ぐボトルに印を付け、残りをそろえる一言に戻すこと", () => {
        tapBottles([4]);
        advanceTime(idleHintDelayMs);

        const hinted = getHintedBottles();
        const headline = screen.getByText("残りの色もそろえると完成です");

        expect(hinted).toEqual([3]);
        expect(headline).toBeTruthy();
      });

      describe("残りをそろえた場合", () => {
        beforeEach(() => {
          tapBottles(remainingBottles);
        });

        test("完成を伝え、レベル1で増えるものを言うこと", () => {
          const headline = screen.getByText("完成です");
          const detail = screen.getByText("レベル1は色もボトルも増えます");

          expect(headline).toBeTruthy();
          expect(detail).toBeTruthy();
        });

        test("本番と同じ完成の音を鳴らすこと", () => {
          const clearedSoundCalls = vi
            .mocked(playSound)
            .mock.calls.filter(([sound]) =>
              String((sound as { url?: string }).url).includes("cleared"),
            );

          expect(clearedSoundCalls).toHaveLength(1);
        });

        test("レベル1を始められること", () => {
          fireEvent.click(
            screen.getByRole("button", { name: "レベル1を遊ぶ" }),
          );

          expect(onStartPlay).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<WaterSortTutorial open={true} onClose={onClose} />);
      skipIntro();
      tapBottles([...stepBottles.flat(), ...remainingBottles]);
    });

    test("解き終えると、プレイ中の盤面も同じルールで解けると伝えること", () => {
      const detail = screen.getByText("プレイ中の盤面も同じルールで解けます");

      expect(detail).toBeTruthy();
    });

    test("解き終えると、プレイに戻れること", () => {
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

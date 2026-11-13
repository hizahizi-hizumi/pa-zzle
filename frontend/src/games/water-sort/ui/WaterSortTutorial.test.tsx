import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import {
  type WaterSortTutorialRejection,
  waterSortTutorial,
} from "@/games/water-sort/tutorial/tutorial";
import { WaterSortTutorial } from "@/games/water-sort/ui/WaterSortTutorial";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
  REPEATED_SOUND_VARIATION: {},
}));

const { intro, steps, freePlay, completion } = waterSortTutorial;

/** 手順ごとに、注ぎ元、注ぎ先の順に印を付けるボトル（1始まり）。 */
const stepBottles = steps.map(({ move }) => [
  move.sourceBottleIndex + 1,
  move.destinationBottleIndex + 1,
]);

/** 手を離した後、青を空のボトルへよけて、最短の5手でそろえるボトル（1始まり）。 */
const solvingBottles = [3, 5, 3, 4, 3, 5, 1, 5, 2, 1] as const;

const idleHintDelayMs = 4000;

const goalFirstBottle = "ボトル 1: 赤、赤、赤、赤";
const startFirstBottle = "ボトル 1: 赤、赤、赤、青";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete (HTMLElement.prototype as { animate?: Element["animate"] }).animate;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** 一言は改行（`\n`）で折り返して見せるので、画面の文字としては空白に読む。 */
function toShownText(text: string): string {
  return text.replaceAll("\n", " ");
}

function queryShownText(text: string): HTMLElement | null {
  return within(getScreen()).queryByText(toShownText(text));
}

function getViolationHeadline(rejection: WaterSortTutorialRejection): string {
  return waterSortTutorial.describeViolation(
    { step: null, earnedRuleIds: [] },
    {
      ...waterSortTutorial.start(),
      lastMove: { type: "rejected", bottleIndex: 0, rejection },
    },
  ).headline;
}

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

function getBottleLabel(bottleNumber: number): string | null {
  return getBottle(bottleNumber).getAttribute("aria-label");
}

function tapBottles(bottleNumbers: readonly number[]): void {
  for (const bottleNumber of bottleNumbers) {
    fireEvent.click(getBottle(bottleNumber));
  }
}

function pressStart(): void {
  fireEvent.click(
    within(getScreen()).getByRole("button", { name: "はじめる" }),
  );
}

function stubReducedMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
}

const pointerSelector =
  '[data-bottle-cue="hint"] [data-tutorial-cue="pointer"]';
const recallSelector = '[data-tutorial-cue="recall"]';
const completedSelector = '[data-bottle-cue="completed"]';

/** 合図を重ねているボトル（1始まり）。 */
function getCuedBottles(selector: string = pointerSelector): number[] {
  return [1, 2, 3, 4, 5].filter((bottleNumber) =>
    getBottle(bottleNumber).querySelector(selector),
  );
}

function getProgressValue(): string | null {
  return within(getScreen())
    .getByRole("progressbar", { name: "チュートリアルの進み具合" })
    .getAttribute("aria-valuenow");
}

function getPlayedSoundNames(): string[] {
  return vi.mocked(playSound).mock.calls.map(
    ([sound]) =>
      String((sound as { url?: string }).url)
        .split("/")
        .at(-1) ?? "",
  );
}

/** 注ぐ動きを、`finishAnimations` を呼ぶまで終えない。 */
function installPendingAnimations(): () => void {
  const resolvers: (() => void)[] = [];
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: vi.fn(
      () =>
        ({
          cancel: vi.fn(),
          finished: new Promise<void>((resolve) => {
            resolvers.push(resolve);
          }),
        }) as unknown as Animation,
    ),
  });
  return () => {
    for (const resolve of resolvers.splice(0)) {
      resolve();
    }
  };
}

describe("WaterSortTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    playStart = { difficulty: "2", onStart: vi.fn<() => void>() };
  });

  describe("開いた場合", () => {
    let rerender: ReturnType<typeof render>["rerender"];

    beforeEach(() => {
      ({ rerender } = render(
        <WaterSortTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      ));
    });

    test("入口で、名前と、何をするパズルかとゴールの一言を、ゴールの盤面と一緒に見せること", () => {
      const title = within(getScreen()).getByRole("heading", {
        name: "ウォーターソート",
      });
      const purpose = queryShownText(intro.purpose);
      const caption = queryShownText(intro.goalCaption);
      const progress = getProgressValue();

      expect(title).toBeTruthy();
      expect(purpose).not.toBeNull();
      expect(caption).not.toBeNull();
      expect(getBottleLabel(1)).toBe(goalFirstBottle);
      expect(progress).toBe("0");
    });

    test("入口でボトルを押しても、ゴールの盤面を見せたまま、はじめるを待つこと", () => {
      tapBottles([1]);

      const startButton = within(getScreen()).queryByRole("button", {
        name: "はじめる",
      });

      expect(getBottleLabel(1)).toBe(goalFirstBottle);
      expect(startButton).not.toBeNull();
    });

    test("はじめるを押すと、始めの盤面に替え、すぐ最初の手順の一言と指さしを出すこと", () => {
      pressStart();

      const headline = queryShownText(steps[0]?.message.headline ?? "");
      const startButton = within(getScreen()).queryByRole("button", {
        name: "はじめる",
      });

      expect(getBottleLabel(1)).toBe(startFirstBottle);
      expect(headline).not.toBeNull();
      expect(getCuedBottles()).toEqual([3]);
      expect(startButton).toBeNull();
    });

    describe("閉じて開き直した場合", () => {
      beforeEach(() => {
        pressStart();
        tapBottles(stepBottles[0] ?? []);
        fireEvent.click(
          within(getScreen()).getByRole("button", { name: "閉じる" }),
        );
        rerender(
          <WaterSortTutorial
            open={false}
            playStart={playStart}
            onClose={onClose}
          />,
        );
      });

      test("閉じる操作を知らせ、開き直すと入口から始めること", () => {
        rerender(
          <WaterSortTutorial
            open={true}
            playStart={playStart}
            onClose={onClose}
          />,
        );

        const purpose = queryShownText(intro.purpose);

        expect(onClose).toHaveBeenCalledOnce();
        expect(purpose).not.toBeNull();
        expect(getBottleLabel(1)).toBe(goalFirstBottle);
        expect(getProgressValue()).toBe("0");
      });
    });
  });

  describe("ゲームのホームから開いて始めた場合", () => {
    beforeEach(() => {
      render(
        <WaterSortTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
      pressStart();
    });

    test("印の無いボトルを押すたびに、選ばず、一言を変えず、鳴らさずに、印の線を濃くし直すこと", () => {
      tapBottles([1]);
      const firstRecall = getBottle(3).querySelector(recallSelector);
      tapBottles([2]);

      const secondRecall = getBottle(3).querySelector(recallSelector);
      const headline = queryShownText(steps[0]?.message.headline ?? "");

      expect(getBottle(1).getAttribute("aria-pressed")).toBe("false");
      expect(headline).not.toBeNull();
      expect(firstRecall).not.toBeNull();
      expect(secondRecall).not.toBeNull();
      expect(secondRecall).not.toBe(firstRecall);
      expect(playSound).not.toHaveBeenCalled();
    });

    test("印のボトルを選ぶと、注ぎ先を指さし、注ぎ先の一言に替えること", () => {
      tapBottles([3]);

      const headline = queryShownText(
        steps[0]?.destinationMessage?.headline ?? "",
      );

      expect(getBottle(3).getAttribute("aria-pressed")).toBe("true");
      expect(getCuedBottles()).toEqual([4]);
      expect(headline).not.toBeNull();
    });

    test("印のとおりに注ぐと、注いで鳴らし、進み具合を進めて次の手順の一言と指さしを出すこと", () => {
      tapBottles(stepBottles[0] ?? []);

      const headline = queryShownText(steps[1]?.message.headline ?? "");

      expect(getBottleLabel(4)).toBe("ボトル 4: 緑");
      expect(playLayeredSound).toHaveBeenCalledOnce();
      expect(Number(getProgressValue())).toBeGreaterThan(0);
      expect(headline).not.toBeNull();
      expect(getCuedBottles()).toEqual([2]);
    });

    describe("注げる先のルールを示した手順で注ぎ元を選んだ場合", () => {
      beforeEach(() => {
        tapBottles([...(stepBottles[0] ?? []), stepBottles[1]?.[0] ?? 0]);
      });

      test("違う色の上を押すと、注がずに鳴らし、注ぎ元を選んだまま注げないわけを言うこと", () => {
        tapBottles([4]);

        const violation = queryShownText(
          getViolationHeadline("different-color"),
        );

        expect(getBottleLabel(2)).toBe("ボトル 2: 赤、緑、緑、青");
        expect(getBottle(2).getAttribute("aria-pressed")).toBe("true");
        expect(violation).not.toBeNull();
        expect(getPlayedSoundNames()).toEqual(["invalid.flac"]);
        expect(getCuedBottles()).toEqual([3]);
      });

      test("わけを言った後に印の無い注げる先を押すと、印の線を濃くし直して手順の一言に戻すこと", () => {
        tapBottles([4, 5]);

        const headline = queryShownText(steps[1]?.message.headline ?? "");

        expect(headline).not.toBeNull();
        expect(getCuedBottles(recallSelector)).toEqual([3]);
      });
    });

    describe("手順をすべて終えた場合", () => {
      beforeEach(() => {
        tapBottles(stepBottles.flat());
      });

      test("手を離して残りを自分でそろえる一言にし、指さしを出さないこと", () => {
        const headline = queryShownText(freePlay.headline);

        expect(headline).not.toBeNull();
        expect(getCuedBottles()).toEqual([]);
      });

      test("手が止まると、最も早くそろう注ぎの注ぎ元を指さすこと", () => {
        advanceTime(idleHintDelayMs - 1);
        const beforeIdle = getCuedBottles();
        advanceTime(1);

        const afterIdle = getCuedBottles();

        expect(beforeIdle).toEqual([]);
        expect(afterIdle).toEqual([1]);
      });

      test("1色そろうと、そのボトルにだけ応え、そろった数と残りの数を言うこと", () => {
        tapBottles(solvingBottles.slice(0, 4));

        const headline = queryShownText("1色そろいました\nあと2色です");

        expect(getBottleLabel(4)).toBe("ボトル 4: 緑、緑、緑、緑");
        expect(getCuedBottles(completedSelector)).toEqual([4]);
        expect(headline).not.toBeNull();
      });

      const rejectionCases = [
        ["注げる先が無いボトル", [3, 5, 2], "no-destination"],
        [
          "同じ色が上にあるボトルが満杯で、ほかに注げる先も無いボトル",
          [3, 5, 4, 3, 4],
          "no-room",
        ],
        ["そろったボトル", [3, 5, 3, 4, 4], "complete"],
        ["空のボトル", [5], "empty"],
        ["違う色の上", [1, 4], "different-color"],
        ["満杯のボトル", [3, 1], "full"],
      ] as const;

      test.each(rejectionCases)(
        "本番で通らない手に、鳴らしてわけを言うこと: %s",
        (_name, bottleNumbers, rejection) => {
          tapBottles(bottleNumbers);

          const violation = queryShownText(getViolationHeadline(rejection));

          expect(violation).not.toBeNull();
          expect(getPlayedSoundNames().at(-1)).toBe("invalid.flac");
        },
      );

      test("注ぎ元を選んだまま手が止まると、そこから注ぐ注ぎ先を指さし、違反の一言を下げること", () => {
        tapBottles([2, 4]);
        advanceTime(idleHintDelayMs);

        const violation = queryShownText(
          getViolationHeadline("different-color"),
        );
        const headline = queryShownText(freePlay.headline);

        expect(getCuedBottles()).toEqual([5]);
        expect(violation).toBeNull();
        expect(headline).not.toBeNull();
      });

      describe("残りをそろえた場合", () => {
        beforeEach(() => {
          tapBottles(solvingBottles);
        });

        test("完成を伝え、覚えたルールを並べ、進み具合を満たすこと", () => {
          const headline = queryShownText(completion.home.headline);
          const detail = queryShownText(completion.home.detail ?? "");
          const recap = within(
            within(getScreen()).getByRole("list", { name: "覚えたルール" }),
          )
            .getAllByRole("listitem")
            .map((item) => item.textContent);

          expect(headline).not.toBeNull();
          expect(detail).not.toBeNull();
          expect(recap).toEqual(
            waterSortTutorial.rules.map(({ label }) => label),
          );
          expect(getProgressValue()).toBe("100");
        });

        test("本番と同じ完成の音を1回鳴らすこと", () => {
          const clearedSounds = getPlayedSoundNames().filter(
            (name) => name === "cleared.flac",
          );

          expect(clearedSounds).toHaveLength(1);
        });

        test("ゲームのホームで開いているレベルを始められること", () => {
          fireEvent.click(
            within(getScreen()).getByRole("button", {
              name: "レベル 2を遊ぶ",
            }),
          );

          expect(playStart.onStart).toHaveBeenCalledOnce();
        });

        test("もう一度を押すと、入口を通さずに、始めの盤面で最初の手順から始めること", () => {
          fireEvent.click(
            within(getScreen()).getByRole("button", { name: "もう一度" }),
          );

          const headline = queryShownText(steps[0]?.message.headline ?? "");
          const startButton = within(getScreen()).queryByRole("button", {
            name: "はじめる",
          });

          expect(getBottleLabel(1)).toBe(startFirstBottle);
          expect(headline).not.toBeNull();
          expect(getCuedBottles()).toEqual([3]);
          expect(startButton).toBeNull();
          expect(getProgressValue()).toBe("0");
        });
      });
    });
  });

  describe("プレイ中に開いて解き終えた場合", () => {
    beforeEach(() => {
      render(<WaterSortTutorial open={true} onClose={onClose} />);
      pressStart();
      tapBottles([...stepBottles.flat(), ...solvingBottles]);
    });

    test("いまの問題も同じルールだと伝え、プレイに戻れること", () => {
      const detail = queryShownText(completion.play.detail ?? "");
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "プレイに戻る" }),
      );

      expect(detail).not.toBeNull();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe("注ぐ動きを見せる場合", () => {
    let finishAnimations: () => void;

    beforeEach(async () => {
      finishAnimations = installPendingAnimations();
      render(
        <WaterSortTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
      pressStart();
      await act(async () => {
        finishAnimations();
      });
      tapBottles(stepBottles[0] ?? []);
    });

    test("注ぎ終えるまでは、一言と進み具合を替えず、指さしを出さず、次の手順の手を受け付けないこと", () => {
      tapBottles(stepBottles[1] ?? []);

      const headline = queryShownText(
        steps[0]?.destinationMessage?.headline ?? "",
      );

      expect(headline).not.toBeNull();
      expect(getProgressValue()).toBe("0");
      expect(getCuedBottles()).toEqual([]);
      expect(getBottle(2).getAttribute("aria-pressed")).toBe("false");
    });

    test("注ぎ終えると、次の手順の一言と指さしを出すこと", async () => {
      await act(async () => {
        finishAnimations();
      });

      const headline = queryShownText(steps[1]?.message.headline ?? "");

      expect(headline).not.toBeNull();
      expect(getCuedBottles()).toEqual([2]);
    });

    describe("ルールに合わない手の後に、印のとおりに注いだ場合", () => {
      beforeEach(async () => {
        await act(async () => {
          finishAnimations();
        });
        tapBottles([2, 4, 3]);
      });

      test("注ぐ動きの間、前の違反の一言を残さず、手順の一言を出すこと", () => {
        const violation = queryShownText(
          getViolationHeadline("different-color"),
        );
        const headline = queryShownText(steps[1]?.message.headline ?? "");

        expect(violation).toBeNull();
        expect(headline).not.toBeNull();
      });
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      installPendingAnimations();
      render(
        <WaterSortTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
      pressStart();
    });

    test("はじめるを押すと、動きを待たずに始めの盤面で最初の手順を指さすこと", () => {
      const headline = queryShownText(steps[0]?.message.headline ?? "");

      expect(getBottleLabel(1)).toBe(startFirstBottle);
      expect(headline).not.toBeNull();
      expect(getCuedBottles()).toEqual([3]);
    });

    test("印の無いボトルを押すと、印の線を濃くし直すこと", () => {
      tapBottles([1]);

      expect(getCuedBottles(recallSelector)).toEqual([3]);
    });

    test("印のとおりに注ぐと、注ぐ動きを待たずに次の手順を指さすこと", () => {
      tapBottles(stepBottles[0] ?? []);

      const headline = queryShownText(steps[1]?.message.headline ?? "");

      expect(headline).not.toBeNull();
      expect(getCuedBottles()).toEqual([2]);
    });
  });
});

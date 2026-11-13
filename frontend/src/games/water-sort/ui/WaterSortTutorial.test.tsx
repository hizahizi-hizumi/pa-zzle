import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { WaterSortTutorial } from "@/games/water-sort/ui/WaterSortTutorial";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
  REPEATED_SOUND_VARIATION: {},
}));

/** 手順ごとに、注ぎ元、注ぎ先の順に印を付けるボトル（1始まり）。満杯のボトルへ注ごうとさせる手順は、印の注ぎ元だけ。 */
const stepBottles = [[1, 4], [3, 4], [2, 5], [5, 3], [5], [3, 5]] as const;

/** 手順を終えた後、同じ色を重ねていってそろえるボトル（1始まり）。 */
const remainingBottles = [2, 1, 3, 4, 2, 4] as const;

const idleHintDelayMs = 4000;

const hiddenRule = "まだ出ていないルール";

const goalFirstBottle = "ボトル 1: 赤、赤、赤、赤";

/** 導入の場面の動きを見せ終えるのに十分な間。 */
const introEnoughMs = 8000;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete (HTMLElement.prototype as { animate?: Element["animate"] }).animate;
  vi.unstubAllGlobals();
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

function stubReducedMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
}

/** 場面の動きを待たずに「次へ」を続けて押し、ゴールと始まりの盤面を通って最初の手順から始める。 */
function pressNextThroughIntro(): void {
  for (
    let next = screen.queryByRole("button", { name: "次へ" });
    next;
    next = screen.queryByRole("button", { name: "次へ" })
  ) {
    fireEvent.click(next);
  }
}

/** 導入は自動では先へ進まない。 */
function pressNext(): void {
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
}

const recallSelector = '[data-tutorial-cue="recall"]';

function getCuedBottles(
  kind: "hint" | "recall" | "completed" = "hint",
): number[] {
  const selector =
    kind === "recall" ? recallSelector : `[data-bottle-cue="${kind}"]`;
  return [1, 2, 3, 4, 5].filter((bottleNumber) =>
    getBottle(bottleNumber).querySelector(selector),
  );
}

function getSpotlitBottles(): number[] {
  return [1, 2, 3, 4, 5].filter((bottleNumber) =>
    getBottle(bottleNumber).querySelector("[data-tutorial-spotlight]"),
  );
}

/** 画面全体の覆いから抜いている所の数。ボトルのほか、一言の面を含む。 */
function getSpotlightCount(): number {
  return document.querySelectorAll("[data-tutorial-spotlight]").length;
}

function getScrim(): Element | null {
  return document.querySelector("[data-tutorial-focus-scrim]");
}

function getPlayedSoundNames(): string[] {
  return vi.mocked(playSound).mock.calls.map(
    ([sound]) =>
      String((sound as { url?: string }).url)
        .split("/")
        .at(-1) ?? "",
  );
}

function getRuleTexts(): string[] {
  return within(screen.getByRole("list", { name: "ルール" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("WaterSortTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    playStart = { difficulty: "2", onStart: vi.fn<() => void>() };
  });

  describe("ゲームのホームから開いた場合", () => {
    beforeEach(() => {
      render(
        <WaterSortTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
      pressNextThroughIntro();
    });

    test("色がばらばらの始めの盤面で、注ぎ元に印を付け、まだ示していないルールを伏せておくこと", () => {
      const headline = screen.getByText(
        "注ぐボトルをタップしてから 注ぎ先をタップします",
      );
      const firstBottle = getBottle(1).getAttribute("aria-label");
      const hinted = getCuedBottles();
      const rules = getRuleTexts();

      expect(headline).toBeTruthy();
      expect(firstBottle).toBe("ボトル 1: 赤、赤、赤、青");
      expect(hinted).toEqual([1]);
      expect(rules).toEqual([hiddenRule, hiddenRule, hiddenRule, hiddenRule]);
    });

    test("画面全体に覆いを重ね、印の注ぎ元と、注ぎ先と、一言の面だけを覆いから抜くこと", () => {
      const scrim = getScrim();
      const spotlit = getSpotlitBottles();
      const spotlightCount = getSpotlightCount();

      expect(scrim).not.toBeNull();
      expect(spotlit).toEqual([1, 4]);
      expect(spotlightCount).toBe(3);
    });

    test("印の無いボトルを押しても、選ばずに、一言を変えず、揺らしも鳴らしもせずに印の線を濃くし直すこと", () => {
      tapBottles([2]);

      const pressed = getBottle(2).getAttribute("aria-pressed");
      const headline = screen.getByText(
        "注ぐボトルをタップしてから 注ぎ先をタップします",
      );
      const hinted = getCuedBottles();
      const recalled = getCuedBottles("recall");

      expect(pressed).toBe("false");
      expect(headline).toBeTruthy();
      expect(hinted).toEqual([1]);
      expect(recalled).toEqual([1]);
      expect(playSound).not.toHaveBeenCalled();
    });

    test("印の無いボトルを続けて押すたびに、印の線を濃くし直すこと", () => {
      tapBottles([2]);
      const firstFlash = getBottle(1).querySelector(recallSelector);
      tapBottles([3]);

      const secondFlash = getBottle(1).querySelector(recallSelector);

      expect(firstFlash).not.toBeNull();
      expect(secondFlash).not.toBeNull();
      expect(secondFlash).not.toBe(firstFlash);
    });

    test("印のボトルを選ぶと、注ぎ先に印を移し、印のボトルへ注ぐと言うこと", () => {
      tapBottles([1]);

      const pressed = getBottle(1).getAttribute("aria-pressed");
      const hinted = getCuedBottles();
      const detail = screen.getByText("印のボトルへ注ぎます");

      expect(pressed).toBe("true");
      expect(hinted).toEqual([4]);
      expect(detail).toBeTruthy();
    });

    test("印のとおりに注ぐと、注いで音を鳴らし、注げる先のルールを示す手順へ進むこと", () => {
      tapBottles(stepBottles[0]);

      const destination = getBottle(4).getAttribute("aria-label");
      const headline = screen.getByText(
        "注げるのは 空のボトルか同じ色の上だけです",
      );
      const hinted = getCuedBottles();
      const rules = getRuleTexts();

      expect(destination).toBe("ボトル 4: 青");
      expect(playLayeredSound).toHaveBeenCalledTimes(1);
      expect(headline).toBeTruthy();
      expect(hinted).toEqual([3]);
      expect(rules).toEqual([
        "空か同じ色へ",
        hiddenRule,
        hiddenRule,
        hiddenRule,
      ]);
    });

    describe("注げる先のルールを示す手順で注ぎ元を選んだ場合", () => {
      beforeEach(() => {
        tapBottles([...stepBottles[0], stepBottles[1][0]]);
      });

      test("注ぎ元と、印の注ぎ先を覆いから抜くこと", () => {
        const spotlit = getSpotlitBottles();

        expect(spotlit).toEqual([3, 4]);
      });

      test("違う色の上を押すと、本番と同じく注がずに音を鳴らし、注ぎ元を選んだまま、注げないわけを言い、押したボトルも覆いから抜くこと", () => {
        tapBottles([2]);

        const source = getBottle(3).getAttribute("aria-label");
        const pressed = getBottle(3).getAttribute("aria-pressed");
        const headline = screen.getByText("違う色の上には注げません");
        const sounds = getPlayedSoundNames();
        const hinted = getCuedBottles();
        const recalled = getCuedBottles("recall");
        const spotlit = getSpotlitBottles();

        expect(source).toBe("ボトル 3: 青、緑、緑、青");
        expect(pressed).toBe("true");
        expect(headline).toBeTruthy();
        expect(sounds).toEqual(["invalid.flac"]);
        expect(hinted).toEqual([4]);
        expect(recalled).toEqual([]);
        expect(spotlit).toEqual([2, 3, 4]);
      });

      test("わけを言った後に印の無い注げる先を押すと、印の線を濃くし直して、手順の一言に戻し、はじいたボトルを覆いに戻すこと", () => {
        tapBottles([2, 5]);

        const headline = screen.getByText(
          "注げるのは 空のボトルか同じ色の上だけです",
        );
        const recalled = getCuedBottles("recall");
        const spotlit = getSpotlitBottles();

        expect(headline).toBeTruthy();
        expect(recalled).toEqual([4]);
        expect(spotlit).toEqual([3, 4]);
      });
    });

    describe("入るぶんだけ移るルールを示す手順に進んだ場合", () => {
      beforeEach(() => {
        tapBottles(stepBottles.slice(0, 3).flat());
      });

      test("ルールを示し、入るぶんだけ移って満杯になる注ぎに印を付け、満杯に注げないことはまだ言わないこと", () => {
        const headline = screen.getByText("入るぶんだけ移ります");
        const fullNotice = screen.queryByText("満杯のボトルには注げません");
        const hinted = getCuedBottles();
        const rules = getRuleTexts();

        expect(headline).toBeTruthy();
        expect(fullNotice).toBeNull();
        expect(hinted).toEqual([5]);
        expect(rules).toEqual([
          "空か同じ色へ",
          "まとめて移る",
          "入るぶんだけ移る",
          hiddenRule,
        ]);
      });
    });

    describe("満杯のルールを示す手順に進んだ場合", () => {
      beforeEach(() => {
        tapBottles(stepBottles.slice(0, 4).flat());
      });

      test("緑が1つだけ移って満杯になったボトルへ、残った緑1つを注ごうとさせる印を付け、満杯に注げないことを言うこと", () => {
        const full = getBottle(3).getAttribute("aria-label");
        const rest = getBottle(5).getAttribute("aria-label");
        const headline = screen.getByText("満杯のボトルには 注げません");
        const detail = screen.getByText("印のボトルから注いでみてください");
        const hinted = getCuedBottles();
        const spotlit = getSpotlitBottles();
        const rules = getRuleTexts();

        expect(full).toBe("ボトル 3: 青、緑、緑、緑");
        expect(rest).toBe("ボトル 5: 緑");
        expect(headline).toBeTruthy();
        expect(detail).toBeTruthy();
        expect(hinted).toEqual([5]);
        expect(spotlit).toEqual([3, 5]);
        expect(rules).toEqual([
          "空か同じ色へ",
          "まとめて移る",
          "入るぶんだけ移る",
          "満杯には注げない",
        ]);
      });

      test("印のボトルを押すと、本番と同じく選ばずに音を鳴らし、注げる先が無いと言って、満杯のボトルから注ぐ印に替えること", () => {
        tapBottles(stepBottles[4]);

        const pressed = getBottle(5).getAttribute("aria-pressed");
        const sounds = getPlayedSoundNames();
        const headline = screen.getByText("注げる先が無いボトルは 選べません");
        const hinted = getCuedBottles();
        const spotlit = getSpotlitBottles();

        expect(pressed).toBe("false");
        expect(sounds).toEqual(["invalid.flac"]);
        expect(headline).toBeTruthy();
        expect(hinted).toEqual([3]);
        expect(spotlit).toEqual([3, 5]);
      });
    });

    describe("手順をすべて終えた場合", () => {
      beforeEach(() => {
        tapBottles(stepBottles.flat());
      });

      test("覆いを重ねず、手が止まって印が出ても覆いを重ねないこと", () => {
        const scrim = getScrim();
        advanceTime(idleHintDelayMs);

        const scrimWithHint = getScrim();
        const spotlit = getSpotlitBottles();

        expect(scrim).toBeNull();
        expect(scrimWithHint).toBeNull();
        expect(spotlit).toEqual([]);
      });

      test("緑をそろえて手を離し、そろったボトルに応えて、そろったボトルから注げないことを言うこと", () => {
        const green = getBottle(5).getAttribute("aria-label");
        const completed = getCuedBottles("completed");
        const headline = screen.getByText("1色そろいました");
        const detail = screen.getByText("そろったボトルからは注げません");
        const hinted = getCuedBottles();

        expect(green).toBe("ボトル 5: 緑、緑、緑、緑");
        expect(completed).toEqual([5]);
        expect(headline).toBeTruthy();
        expect(detail).toBeTruthy();
        expect(hinted).toEqual([]);
      });

      test("注ぎ元を選んでも、そろったことの一言と応えを残すこと", () => {
        tapBottles([2]);

        const headline = screen.getByText("1色そろいました");
        const completed = getCuedBottles("completed");

        expect(headline).toBeTruthy();
        expect(completed).toEqual([5]);
      });

      test("次に注ぐと、そろったことの一言を下げ、残りをそろえる一言にすること", () => {
        tapBottles([4, 3]);

        const completedNotice = screen.queryByText("1色そろいました");
        const headline = screen.getByText("残りもそろえたら完成です");

        expect(completedNotice).toBeNull();
        expect(headline).toBeTruthy();
      });

      test.each([
        ["そろったボトル", [5], "そろったボトルからは注げません"],
        ["空のボトル", [2, 1, 3, 4, 3], "空のボトルからは注げません"],
        ["違う色の上", [2, 4], "違う色の上には注げません"],
        ["注ぎ先が無いボトル", [1, 2, 1], "今は注ぎ先がありません"],
      ] as const)(
        "本番で通らない手に、わけを言うこと: %s",
        (_name, bottleNumbers, expected) => {
          tapBottles(bottleNumbers);

          const headline = screen.getByText(expected);

          expect(headline).toBeTruthy();
        },
      );

      test("注ぎ元を選んだまま手が止まると、そこから注ぐ注ぎ先に印を付け、残りをそろえる一言に戻すこと", () => {
        tapBottles([2, 4]);
        advanceTime(idleHintDelayMs);

        const hinted = getCuedBottles();
        const headline = screen.getByText("残りもそろえたら完成です");

        expect(hinted).toEqual([1]);
        expect(headline).toBeTruthy();
      });

      describe("残りをそろえた場合", () => {
        beforeEach(() => {
          tapBottles(remainingBottles);
        });

        test("完成を伝え、どのレベルも同じルールだと言い、本番の完成の動きのほかに合図を重ねないこと", () => {
          const headline = screen.getByText("完成です");
          const detail = screen.getByText("どのレベルも同じルールです");
          const completed = getCuedBottles("completed");

          expect(headline).toBeTruthy();
          expect(detail).toBeTruthy();
          expect(completed).toEqual([]);
        });

        test("本番と同じ完成の音を鳴らすこと", () => {
          const clearedSoundCalls = vi
            .mocked(playSound)
            .mock.calls.filter(([sound]) =>
              String((sound as { url?: string }).url).includes("cleared"),
            );

          expect(clearedSoundCalls).toHaveLength(1);
        });

        test("ゲームのホームで開いているレベルを始められること", () => {
          fireEvent.click(
            screen.getByRole("button", { name: "レベル 2を遊ぶ" }),
          );

          expect(playStart.onStart).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe("注ぐ動きを見せる場合", () => {
    let finishAnimations: () => void;

    beforeEach(() => {
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
      finishAnimations = () => {
        for (const resolve of resolvers.splice(0)) {
          resolve();
        }
      };
      render(
        <WaterSortTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
      pressNextThroughIntro();
      advanceTime(introEnoughMs);
      tapBottles(stepBottles[0]);
    });

    test("注ぐ動きを見せる間は、覆いを外すこと", () => {
      const scrim = getScrim();

      expect(scrim).toBeNull();
    });

    test("注ぎ終えると、次の手順の注ぎ元と注ぎ先を抜いて覆いを戻すこと", async () => {
      await act(async () => {
        finishAnimations();
      });

      const scrim = getScrim();
      const spotlit = getSpotlitBottles();

      expect(scrim).not.toBeNull();
      expect(spotlit).toEqual([3, 4]);
    });

    test("注ぎ終えるまでは、一言とルールの並びを替えず、次の印も付けないこと", () => {
      const headline = screen.getByText(
        "注ぐボトルをタップしてから 注ぎ先をタップします",
      );
      const rules = getRuleTexts();
      const hinted = getCuedBottles();

      expect(headline).toBeTruthy();
      expect(rules).toEqual([hiddenRule, hiddenRule, hiddenRule, hiddenRule]);
      expect(hinted).toEqual([]);
    });

    test("注ぎ終えるまでは、次の手順の手を受け付けないこと", () => {
      tapBottles(stepBottles[1]);

      const source = getBottle(3).getAttribute("aria-label");
      const pressed = getBottle(3).getAttribute("aria-pressed");

      expect(source).toBe("ボトル 3: 青、緑、緑、青");
      expect(pressed).toBe("false");
    });

    describe("ルールに合わない手の後に、印のとおりに注いだ場合", () => {
      beforeEach(async () => {
        await act(async () => {
          finishAnimations();
        });
        tapBottles([3, 2, 4]);
      });

      test("注ぐ動きの間、前の違反の一言を残さず、手順の一言を出すこと", () => {
        const violation = screen.queryByText("違う色の上には注げません");
        const headline = screen.getByText(
          "注げるのは 空のボトルか同じ色の上だけです",
        );

        expect(violation).toBeNull();
        expect(headline).toBeTruthy();
      });
    });

    describe("手を離した後、そろう注ぎの動きの間に次のボトルを選んだ場合", () => {
      beforeEach(async () => {
        for (const bottles of stepBottles.slice(1)) {
          await act(async () => {
            finishAnimations();
          });
          tapBottles(bottles);
        }
        await act(async () => {
          finishAnimations();
        });
        tapBottles([2, 1, 3]);
        await act(async () => {
          finishAnimations();
        });
      });

      test("注ぎ終えてから、そろったボトルに応えること", () => {
        const red = getBottle(1).getAttribute("aria-label");
        const pressed = getBottle(3).getAttribute("aria-pressed");
        const completed = getCuedBottles("completed");

        expect(red).toBe("ボトル 1: 赤、赤、赤、赤");
        expect(pressed).toBe("true");
        expect(completed).toEqual([1]);
      });
    });

    test("注ぎ終えると、次の手順の一言とルールに替え、次の印を付けること", async () => {
      await act(async () => {
        finishAnimations();
      });

      const headline = screen.getByText(
        "注げるのは 空のボトルか同じ色の上だけです",
      );
      const rules = getRuleTexts();
      const hinted = getCuedBottles();

      expect(headline).toBeTruthy();
      expect(rules).toEqual([
        "空か同じ色へ",
        hiddenRule,
        hiddenRule,
        hiddenRule,
      ]);
      expect(hinted).toEqual([3]);
    });
  });

  describe("導入を見せる場合", () => {
    beforeEach(() => {
      Object.defineProperty(HTMLElement.prototype, "animate", {
        configurable: true,
        value: vi.fn(
          () =>
            ({
              cancel: vi.fn(),
              finished: Promise.resolve(),
            }) as unknown as Animation,
        ),
      });
      render(
        <WaterSortTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
    });

    test("開くと、名前と何をするパズルか、ゴールの盤面を見せること", () => {
      const title = screen.getByRole("heading", { name: "ウォーターソート" });
      const purpose = screen.getByText(
        "ボトルの水を注ぎ分けて 色をそろえるパズルです",
      );
      const firstBottle = getBottle(1).getAttribute("aria-label");

      expect(title).toBeTruthy();
      expect(purpose).toBeTruthy();
      expect(firstBottle).toBe(goalFirstBottle);
    });

    test("ボトルを押しても、手順へ飛ばずに、ゴールの盤面を見せたまま次へを待つこと", () => {
      fireEvent.pointerDown(getBottle(1));
      advanceTime(introEnoughMs);

      const caption = screen.getByText("どの色も1本にそろったらゴールです");
      const nextButton = screen.queryByRole("button", { name: "次へ" });
      const firstBottle = getBottle(1).getAttribute("aria-label");

      expect(caption).toBeTruthy();
      expect(nextButton).not.toBeNull();
      expect(firstBottle).toBe(goalFirstBottle);
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      render(
        <WaterSortTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
    });

    test("最初の画面で、何をするパズルかとゴールの盤面を、ゴールの一言と一緒に見せること", () => {
      const purpose = screen.getByText(
        "ボトルの水を注ぎ分けて 色をそろえるパズルです",
      );
      const caption = screen.getByText("どの色も1本にそろったらゴールです");
      const firstBottle = getBottle(1).getAttribute("aria-label");

      expect(purpose).toBeTruthy();
      expect(caption).toBeTruthy();
      expect(firstBottle).toBe(goalFirstBottle);
    });

    test("ゴールで次へを押すと、始まりの一言を添えて色がばらばらの始めの盤面を見せること", () => {
      pressNext();

      const caption = screen.getByText("最初は色がばらばらです");
      const firstBottle = getBottle(1).getAttribute("aria-label");

      expect(caption).toBeTruthy();
      expect(firstBottle).toBe("ボトル 1: 赤、赤、赤、青");
    });

    test("次へで最後まで進めると、最初の手順の一言と印を出すこと", () => {
      pressNextThroughIntro();

      const headline = screen.getByText(
        "注ぐボトルをタップしてから 注ぎ先をタップします",
      );
      const hinted = getCuedBottles();

      expect(headline).toBeTruthy();
      expect(hinted).toEqual([1]);
    });

    test("印の無いボトルを押すと、動きを減らす設定でも印の線を濃くし直すこと", () => {
      pressNextThroughIntro();
      tapBottles([2]);

      const recalled = getCuedBottles("recall");

      expect(recalled).toEqual([1]);
    });

    test("印のとおりに注ぐと、注ぐ動きを見せずに、覆いを重ねたまま次の手順の注ぎ元と注ぎ先を抜くこと", () => {
      pressNextThroughIntro();
      tapBottles(stepBottles[0]);

      const scrim = getScrim();
      const spotlit = getSpotlitBottles();

      expect(scrim).not.toBeNull();
      expect(spotlit).toEqual([3, 4]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<WaterSortTutorial open={true} onClose={onClose} />);
      pressNextThroughIntro();
      tapBottles([...stepBottles.flat(), ...remainingBottles]);
    });

    test("解き終えると、プレイ中の盤面も同じルールで解けると伝えること", () => {
      const detail = screen.getByText("プレイ中の盤面も同じルールです");

      expect(detail).toBeTruthy();
    });

    test("解き終えると、プレイに戻れること", () => {
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

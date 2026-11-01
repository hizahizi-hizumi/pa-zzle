import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { WaterSortTutorial } from "@/games/water-sort/ui/WaterSortTutorial";

/** 手順ごとに押す、注ぎ元と注ぎ先のボトル（0始まり）。 */
const stepTaps = [0, 3, 1, 3, 2, 3, 3, 1, 0] as const;

/** 手順を終えた後、残りの赤と青をそろえる注ぎ。 */
const remainingTaps = [0, 4, 1, 4, 2, 4, 1, 0, 2, 0] as const;

/** そろったボトルを押させる手順で、揺れと縁の色の合図を見届けてから次の手順へ進むまでの間。 */
const rejectionStepHoldMs = 900;

/** 手を離した後、手が止まってから次に押すボトルを示すまでの間。 */
const idleHintDelayMs = 4000;

/** 動きを減らす設定で、ゴールの盤面を見せる間。 */
const stillGoalHoldMs = 2800;

/** 導入を最後まで見せるのに十分な間。 */
const introEnoughMs = 8000;

const firstHeadline = "注ぐボトルを押して選びます";
const freePlayHeadline = "残りの色もそろえると完成です";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubReducedMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
}

function advanceTime(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function getBottles(): HTMLElement[] {
  return within(screen.getByRole("main")).getAllByRole("button", {
    name: /^ボトル /,
  });
}

function getBottle(bottleIndex: number): HTMLElement {
  const bottle = getBottles()[bottleIndex];
  if (!bottle) {
    throw new Error(`ボトル ${bottleIndex + 1} がない`);
  }
  return bottle;
}

function getBottleContents(bottleIndex: number): string {
  return (getBottle(bottleIndex).getAttribute("aria-label") ?? "").replace(
    /^ボトル \d+: /,
    "",
  );
}

function tapBottles(bottleIndices: readonly number[]): void {
  for (const bottleIndex of bottleIndices) {
    fireEvent.click(getBottle(bottleIndex));
  }
}

/** 合図を付けたボトルの番号（1始まり）。既定は、次に押すボトルの印。 */
function getCuedBottles(
  kind: "hint" | "sorted" | "sorted-held" | "rejected" = "hint",
): number[] {
  return getBottles().flatMap((bottle, bottleIndex) =>
    bottle.querySelector(`[data-bottle-cue="${kind}"]`)
      ? [bottleIndex + 1]
      : [],
  );
}

function getRuleTexts(): string[] {
  return within(screen.getByRole("list", { name: "ルール" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

/** 導入を飛ばして、最初の手順から始める。 */
function skipIntro(): void {
  fireEvent.pointerDown(screen.getByRole("main"));
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

    test("混ざった始めの盤面で、注ぎ元のボトルを示し、まだ示していないルールを伏せておくこと", () => {
      const headline = screen.getByText(firstHeadline);
      const contents = getBottleContents(0);
      const cued = getCuedBottles();
      const rules = getRuleTexts();

      expect(headline).toBeTruthy();
      expect(contents).toBe("赤、赤、青、緑");
      expect(cued).toEqual([1]);
      expect(rules).toEqual(["？", "？", "？", "？", "？"]);
    });

    test("印の注ぎ元を押すと選び、印を空のボトルへ移して、空のボトルに注げることを示すこと", () => {
      tapBottles([0]);

      const pressed = getBottle(0).getAttribute("aria-pressed");
      const cued = getCuedBottles();
      const headline = screen.getByText("空のボトルに注げます");
      const detail = screen.getByText(
        "選んだボトルをもう一度押すと選び直せます",
      );
      const rules = getRuleTexts();

      expect(pressed).toBe("true");
      expect(cued).toEqual([4]);
      expect(headline).toBeTruthy();
      expect(detail).toBeTruthy();
      expect(rules).toEqual(["空ボトル", "？", "？", "？", "？"]);
    });

    test("選んだ注ぎ元をもう一度押して選び直すと、選ぶ一言と注ぎ元の印に戻すこと", () => {
      tapBottles([0, 0]);

      const pressed = getBottle(0).getAttribute("aria-pressed");
      const headline = screen.getByText(firstHeadline);
      const cued = getCuedBottles();
      const rules = getRuleTexts();

      expect(pressed).toBe("false");
      expect(headline).toBeTruthy();
      expect(cued).toEqual([1]);
      expect(rules).toEqual(["？", "？", "？", "？", "？"]);
    });

    test("印の無いボトルを押しても、選ばずに、一言を変えずに印を付け直すこと", () => {
      tapBottles([1]);

      const pressed = getBottle(1).getAttribute("aria-pressed");
      const headline = screen.getByText(firstHeadline);
      const cued = getCuedBottles();

      expect(pressed).toBe("false");
      expect(headline).toBeTruthy();
      expect(cued).toEqual([1]);
    });

    test("印のとおりに注ぐと、空のボトルに注ぎ、次のルールを示すこと", () => {
      tapBottles([0, 3]);

      const contents = [getBottleContents(0), getBottleContents(3)];
      const headline = screen.getByText(
        "上の色が同じときだけ その上に注げます",
      );
      const cued = getCuedBottles();
      const rules = getRuleTexts();

      expect(contents).toEqual(["赤、赤、青", "緑"]);
      expect(headline).toBeTruthy();
      expect(cued).toEqual([2]);
      expect(rules).toEqual(["空ボトル", "同じ色", "？", "？", "？"]);
    });

    test("重なった同じ色をまとめて注いで緑をそろえ、そろった緑のボトルを光らせて、そのボトルを押させること", () => {
      tapBottles(stepTaps.slice(0, 6));

      const contents = [getBottleContents(2), getBottleContents(3)];
      const sorted = getCuedBottles("sorted");
      const cued = getCuedBottles();
      const headline = screen.getByText("そろったボトルからは注げません");
      const rules = getRuleTexts();

      expect(contents).toEqual(["赤、青", "緑、緑、緑、緑"]);
      expect(sorted).toEqual([4]);
      expect(cued).toEqual([4]);
      expect(headline).toBeTruthy();
      expect(rules).toEqual([
        "空ボトル",
        "同じ色",
        "まとめて",
        "そろった",
        "？",
      ]);
    });

    test("そろったボトルを押すと、選ばずに縁の色で受け付けなかったことを返し、その合図を見届けてから次のルールの一言と印へ進むこと", () => {
      tapBottles(stepTaps.slice(0, 7));
      const pressed = getBottle(3).getAttribute("aria-pressed");
      const rejected = getCuedBottles("rejected");
      const heldHeadline = screen.getByText("そろったボトルからは注げません");
      const heldCued = getCuedBottles();
      advanceTime(rejectionStepHoldMs - 1);
      const stillHeld = screen.queryByText("そろったボトルからは注げません");
      advanceTime(1);

      const headline = screen.getByText("入る分だけ移ります");
      const cued = getCuedBottles();
      const rules = getRuleTexts();

      expect(pressed).toBe("false");
      expect(rejected).toEqual([4]);
      expect(heldHeadline).toBeTruthy();
      expect(heldCued).toEqual([]);
      expect(stillHeld).not.toBeNull();
      expect(headline).toBeTruthy();
      expect(cued).toEqual([2]);
      expect(rules).toEqual([
        "空ボトル",
        "同じ色",
        "まとめて",
        "そろった",
        "入るだけ",
      ]);
    });

    test("空きの足りないボトルへ注ぐと、入るだけ移して残りを注ぎ元に残すこと", () => {
      tapBottles(stepTaps);

      const contents = [getBottleContents(0), getBottleContents(1)];

      expect(contents).toEqual(["赤、赤、青、青", "赤、青"]);
    });

    describe("手順を終えた場合", () => {
      beforeEach(() => {
        tapBottles(stepTaps);
      });

      test("残りをそろえることを伝え、手が止まったときだけ次に押すボトルを示すこと", () => {
        const headline = screen.getByText(freePlayHeadline);
        const cuedBeforeIdle = getCuedBottles();
        advanceTime(idleHintDelayMs);

        const cued = getCuedBottles();

        expect(headline).toBeTruthy();
        expect(cuedBeforeIdle).toEqual([]);
        expect(cued).toHaveLength(1);
      });

      test("示した注ぎ元を選ぶと、待たせずに注ぎ先を示すこと", () => {
        advanceTime(idleHintDelayMs);
        const [source] = getCuedBottles();
        tapBottles(source === undefined ? [] : [source - 1]);

        const cued = getCuedBottles();

        expect(cued).toHaveLength(1);
        expect(cued).not.toEqual([source]);
      });

      test("上の色が違うボトルへ注ごうとすると、わけを伝え、次に注ぐと一言を戻すこと", () => {
        tapBottles([1, 4, 2, 4, 1, 4]);
        const headline = screen.getByText("上の色が違うと注げません");
        tapBottles([2]);

        const restored = screen.getByText(freePlayHeadline);

        expect(headline).toBeTruthy();
        expect(restored).toBeTruthy();
      });

      test("注げずに手が止まると、印と一緒に残りをそろえる一言に戻すこと", () => {
        tapBottles([1, 0]);
        const headline = screen.getByText("満杯のボトルには注げません");
        advanceTime(idleHintDelayMs);

        const restored = screen.getByText(freePlayHeadline);
        const cued = getCuedBottles();

        expect(headline).toBeTruthy();
        expect(restored).toBeTruthy();
        expect(cued).toHaveLength(1);
      });

      test("そろえ終えると、そろったボトルをすべて光らせてレベル1とのつながりを伝え、レベル1を遊ぶでレベル1を始めること", () => {
        tapBottles(remainingTaps);
        const sorted = getCuedBottles("sorted-held");
        const detail = screen.getByText(
          "レベル1は色が増えますが ルールは同じです",
        );
        fireEvent.click(screen.getByRole("button", { name: "レベル1を遊ぶ" }));

        expect(sorted).toEqual([1, 4, 5]);
        expect(detail).toBeTruthy();
        expect(onStartPlay).toHaveBeenCalledOnce();
      });

      test("そろえ終えた後のもう一度で、始まりの盤面を見せてから最初の手順を始めること", () => {
        tapBottles(remainingTaps);
        fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
        const caption = screen.getByText("最初は色が混ざっています");
        advanceTime(introEnoughMs);

        const contents = getBottleContents(0);
        const cued = getCuedBottles();
        const rules = getRuleTexts();

        expect(caption).toBeTruthy();
        expect(contents).toBe("赤、赤、青、緑");
        expect(cued).toEqual([1]);
        expect(rules).toEqual(["？", "？", "？", "？", "？"]);
      });
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      render(<WaterSortTutorial open={true} onClose={onClose} />);
    });

    test("最初の画面で、何をするパズルかとゴールの盤面を、ゴールの一言と一緒に見せること", () => {
      const purpose = screen.getByText(
        "液体を注ぎ分けて 色をそろえるパズルです",
      );
      const caption = screen.getByText("色ごとに1本にそろえばゴールです");
      const contents = getBottleContents(2);

      expect(purpose).toBeTruthy();
      expect(caption).toBeTruthy();
      expect(contents).toBe("赤、赤、赤、赤");
    });

    test("ゴールを見せた後に、始まりの一言を添えて混ざった始めの盤面を見せること", () => {
      advanceTime(stillGoalHoldMs);

      const caption = screen.getByText("最初は色が混ざっています");
      const contents = getBottleContents(0);

      expect(caption).toBeTruthy();
      expect(contents).toBe("赤、赤、青、緑");
    });

    test("最後まで見せると、最初の手順の一言と印を出すこと", () => {
      advanceTime(stillGoalHoldMs);
      advanceTime(introEnoughMs);

      const headline = screen.getByText(firstHeadline);
      const cued = getCuedBottles();

      expect(headline).toBeTruthy();
      expect(cued).toEqual([1]);
    });

    test("そろったボトルを押すと、揺れの代わりにそのボトルの縁で受け付けなかったことを返すこと", () => {
      advanceTime(stillGoalHoldMs);
      advanceTime(introEnoughMs);
      tapBottles(stepTaps.slice(0, 7));

      const rejected = getCuedBottles("rejected");

      expect(rejected).toEqual([4]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<WaterSortTutorial open={true} onClose={onClose} />);
      skipIntro();
    });

    test("そろえ終えると、プレイに戻ることを伝え、プレイに戻る操作で閉じること", () => {
      tapBottles([...stepTaps, ...remainingTaps]);
      const detail = screen.getByText("プレイ中の盤面も同じルールで解けます");
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(detail).toBeTruthy();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});

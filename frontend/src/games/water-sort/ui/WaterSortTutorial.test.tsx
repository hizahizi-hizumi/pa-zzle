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
const stepTaps = [0, 3, 2, 3, 1, 3] as const;

/** 手順を終えた後、残りの赤と青をそろえる注ぎ。 */
const remainingTaps = [0, 4, 1, 0, 1, 4, 2, 0, 2, 4, 0, 2, 0, 4] as const;

/** 手を離した後、手が止まってから次に押すボトルを示すまでの間。 */
const idleHintDelayMs = 4000;

/** 動きを減らす設定で、ゴールの盤面を見せる間。 */
const stillGoalHoldMs = 2800;

/** 導入を最後まで見せるのに十分な間。 */
const introEnoughMs = 8000;

const firstHeadline = "ボトルを選んで 空のボトルに注ぎます";
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

/** 印を付けたボトルの番号（1始まり）。 */
function getCuedBottles(): number[] {
  return getBottles().flatMap((bottle, bottleIndex) =>
    bottle.querySelector('[data-bottle-cue="hint"]') ? [bottleIndex + 1] : [],
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
      expect(contents).toBe("赤、青、赤、緑");
      expect(cued).toEqual([1]);
      expect(rules).toEqual(["空のボトルへ", "？", "？"]);
    });

    test("印の注ぎ元を押すと選び、印を注ぎ先へ移すこと", () => {
      tapBottles([0]);

      const pressed = getBottle(0).getAttribute("aria-pressed");
      const cued = getCuedBottles();

      expect(pressed).toBe("true");
      expect(cued).toEqual([4]);
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
        "いちばん上が同じ色なら その上に注げます",
      );
      const cued = getCuedBottles();
      const rules = getRuleTexts();

      expect(contents).toEqual(["赤、青、赤", "緑"]);
      expect(headline).toBeTruthy();
      expect(cued).toEqual([3]);
      expect(rules).toEqual(["空のボトルへ", "同じ色の上へ", "？"]);
    });

    test("上に続く同じ色をまとめて注ぎ、緑をそろえること", () => {
      tapBottles(stepTaps);

      const contents = [getBottleContents(1), getBottleContents(3)];
      const rules = getRuleTexts();

      expect(contents).toEqual(["赤、青", "緑、緑、緑、緑"]);
      expect(rules).toEqual(["空のボトルへ", "同じ色の上へ", "まとめて移る"]);
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

      test("いちばん上の色が違うボトルへ注ごうとすると、わけを伝え、次に注ぐと一言を戻すこと", () => {
        tapBottles([0, 1]);
        const headline = screen.getByText(
          "いちばん上の色が違うボトルには注げません",
        );
        tapBottles([4]);

        const restored = screen.getByText(freePlayHeadline);

        expect(headline).toBeTruthy();
        expect(restored).toBeTruthy();
      });

      test("そろえ終えると、レベル1とのつながりを伝え、レベル1を遊ぶでレベル1を始めること", () => {
        tapBottles(remainingTaps);
        const detail = screen.getByText(
          "レベル1は色が増えますが ルールは同じです",
        );
        fireEvent.click(screen.getByRole("button", { name: "レベル1を遊ぶ" }));

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
        expect(contents).toBe("赤、青、赤、緑");
        expect(cued).toEqual([1]);
        expect(rules).toEqual(["空のボトルへ", "？", "？"]);
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
        "液体を注ぎ分けて 色ごとに1本のボトルへそろえるパズルです",
      );
      const caption = screen.getByText("この形がゴールです");
      const contents = getBottleContents(0);

      expect(purpose).toBeTruthy();
      expect(caption).toBeTruthy();
      expect(contents).toBe("赤、赤、赤、赤");
    });

    test("ゴールを見せた後に、始まりの一言を添えて混ざった始めの盤面を見せること", () => {
      advanceTime(stillGoalHoldMs);

      const caption = screen.getByText("最初は色が混ざっています");
      const contents = getBottleContents(0);

      expect(caption).toBeTruthy();
      expect(contents).toBe("赤、青、赤、緑");
    });

    test("最後まで見せると、最初の手順の一言と印を出すこと", () => {
      advanceTime(stillGoalHoldMs);
      advanceTime(introEnoughMs);

      const headline = screen.getByText(firstHeadline);
      const cued = getCuedBottles();

      expect(headline).toBeTruthy();
      expect(cued).toEqual([1]);
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

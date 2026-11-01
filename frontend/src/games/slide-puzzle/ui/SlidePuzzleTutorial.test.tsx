import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { SlidePuzzleTutorial } from "@/games/slide-puzzle/ui/SlidePuzzleTutorial";

/** 手順ごとに印を付けるタイル。 */
const stepTiles = [5, 8, 4] as const;

/** 手順を終えた後、行と列をまとめてスライドさせて完成させるタイル。 */
const remainingTiles = [2, 6] as const;

/** 手順どおりにスライドさせてから、次の印を付けるまでの間。 */
const nextStepCueDelayMs = 450;

/** 手を離した後、手が止まってから次のタイルを示すまでの間。 */
const idleHintDelayMs = 4000;

/** 動きを減らす設定で、ゴールの盤面を見せる間。 */
const stillGoalHoldMs = 2800;

/** 導入を最後まで見せるのに十分な間。 */
const introEnoughMs = 8000;

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { animate?: Element["animate"] }).animate;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function installAnimate(): void {
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
}

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

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "盤面" });
}

function getTile(tile: number): HTMLElement {
  return within(getBoard()).getByRole("button", { name: String(tile) });
}

function tapTiles(tiles: readonly number[]): void {
  for (const tile of tiles) {
    fireEvent.click(getTile(tile));
  }
}

/** 導入を飛ばして、最初の手順から始める。 */
function skipIntro(): void {
  fireEvent.pointerDown(getBoard());
}

/** 盤面の上の、行・列（1始まり）。 */
function getTilePosition(tile: number): string {
  const match = /translate\((\d+)%, (\d+)%\)/.exec(
    getTile(tile).style.transform,
  );
  return match
    ? `${Number(match[2]) / 100 + 1}行${Number(match[1]) / 100 + 1}列`
    : "";
}

function getCuedTiles(kind: "hint" | "landed"): string[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter((tile) => tile.querySelector(`[data-tile-cue="${kind}"]`))
    .map((tile) => tile.textContent ?? "");
}

function getRuleChipTexts(): string[] {
  return within(screen.getByRole("list", { name: "ルール" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("SlidePuzzleTutorial", () => {
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
        <SlidePuzzleTutorial
          open={true}
          onStartPlay={onStartPlay}
          onClose={onClose}
        />,
      );
      skipIntro();
    });

    test("崩れた始めの盤面で、空白の隣のタイルのタップを示し、まだ示していないルールを伏せておくこと", () => {
      const headline = screen.getByText(
        "空白の隣のタイルをタップすると 空白にスライドします",
      );
      const positions = [getTilePosition(4), getTilePosition(5)];
      const hinted = getCuedTiles("hint");
      const chips = getRuleChipTexts();

      expect(headline).toBeTruthy();
      expect(positions).toEqual(["1行1列", "3行2列"]);
      expect(hinted).toEqual(["5"]);
      expect(chips).toEqual(["空白にスライド", "？"]);
    });

    test("印の無いタイルを押しても、スライドさせずに、印のタイルをタップするよう伝えて印を付け直すこと", () => {
      tapTiles([7]);

      const position = getTilePosition(7);
      const detail = screen.getByText("今は印のタイルをタップしてください");
      const hinted = getCuedTiles("hint");

      expect(position).toBe("2行1列");
      expect(detail).toBeTruthy();
      expect(hinted).toEqual(["5"]);
    });

    test("印のタイルをタップすると、空白にスライドして収まり、収まってから次の印を付けること", () => {
      tapTiles([5]);
      const position = getTilePosition(5);
      const landed = getCuedTiles("landed");
      const headline = screen.getByText("5 が正しい位置に収まりました");
      const hintedBeforeDelay = getCuedTiles("hint");
      advanceTime(nextStepCueDelayMs);

      const hinted = getCuedTiles("hint");

      expect(position).toBe("2行2列");
      expect(landed).toEqual(["5"]);
      expect(headline).toBeTruthy();
      expect(hintedBeforeDelay).toEqual([]);
      expect(hinted).toEqual(["8"]);
    });

    describe("同じ行・列のルールを示す手順に進んだ場合", () => {
      beforeEach(() => {
        tapTiles(stepTiles.slice(0, 2));
        advanceTime(nextStepCueDelayMs);
      });

      test("隣にある 7 をタップすると、スライドさせずに、4 なら 7 も同時に収まることを伝えること", () => {
        tapTiles([7]);

        const position = getTilePosition(7);
        const headline = screen.getByText("4 なら 7 も同時に収まります");
        const hinted = getCuedTiles("hint");

        expect(position).toBe("2行1列");
        expect(headline).toBeTruthy();
        expect(hinted).toEqual(["4"]);
      });

      test("空白と同じ行・列にないタイルをタップすると、スライドさせずにわけを伝えること", () => {
        tapTiles([5]);

        const position = getTilePosition(5);
        const headline = screen.getByText("5 は空白と同じ行・列にありません");

        expect(position).toBe("2行2列");
        expect(headline).toBeTruthy();
      });

      test("ルールをチップに加え、離れたタイルをタップすると間のタイルもまとめてスライドさせること", () => {
        const chips = getRuleChipTexts();
        tapTiles([4]);

        const positions = [getTilePosition(4), getTilePosition(7)];
        const landed = getCuedTiles("landed");

        expect(chips).toEqual(["空白にスライド", "同じ行・列はまとめて"]);
        expect(positions).toEqual(["2行1列", "3行1列"]);
        expect(landed).toEqual(["4", "7"]);
      });
    });

    describe("手順を終えた場合", () => {
      beforeEach(() => {
        tapTiles(stepTiles);
      });

      test("残りを並べることを伝え、手が止まったときだけ次にスライドさせるタイルを示すこと", () => {
        const headline = screen.getByText("残りも正しい位置に収めると完成です");
        const hintedBeforeIdle = getCuedTiles("hint");
        advanceTime(idleHintDelayMs);

        const hinted = getCuedTiles("hint");

        expect(headline).toBeTruthy();
        expect(hintedBeforeIdle).toEqual([]);
        expect(hinted).toEqual(["1"]);
      });

      test("空白と同じ行・列にないタイルをタップすると、スライドさせずにわけを伝え、次にスライドさせると一言を戻すこと", () => {
        tapTiles([3]);
        const position = getTilePosition(3);
        const headline = screen.getByText("3 は空白と同じ行・列にありません");
        tapTiles([1]);

        const restored = screen.getByText("残りも正しい位置に収めると完成です");

        expect(position).toBe("2行3列");
        expect(headline).toBeTruthy();
        expect(restored).toBeTruthy();
      });

      test("空白と同じ行・列にないタイルをタップした後に止まると、印を出して、残りを収める一言に戻すこと", () => {
        tapTiles([3]);
        advanceTime(idleHintDelayMs);

        const headline = screen.getByText("残りも正しい位置に収めると完成です");
        const hinted = getCuedTiles("hint");

        expect(headline).toBeTruthy();
        expect(hinted).toEqual(["1"]);
      });

      test("並べ終えると、レベル1とのつながりを伝え、レベル1を遊ぶでレベル1を始めること", () => {
        tapTiles(remainingTiles);
        const detail = screen.getByText(
          "レベル1も同じルールで ほかのタイルをどかしながら並べます",
        );
        fireEvent.click(screen.getByRole("button", { name: "レベル1を遊ぶ" }));

        expect(detail).toBeTruthy();
        expect(onStartPlay).toHaveBeenCalledOnce();
      });

      test("並べ終えた後のもう一度で、始まりの盤面を見せてから最初の手順を始めること", () => {
        tapTiles(remainingTiles);
        fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
        const caption = screen.getByText("最初はこのように崩れています");
        advanceTime(introEnoughMs);

        const position = getTilePosition(5);
        const hinted = getCuedTiles("hint");
        const chips = getRuleChipTexts();

        expect(caption).toBeTruthy();
        expect(position).toBe("3行2列");
        expect(hinted).toEqual(["5"]);
        expect(chips).toEqual(["空白にスライド", "？"]);
      });
    });
  });

  describe("導入を見せる場合", () => {
    beforeEach(() => {
      installAnimate();
      render(
        <SlidePuzzleTutorial
          open={true}
          onStartPlay={onStartPlay}
          onClose={onClose}
        />,
      );
    });

    test("開くと、名前と何をするパズルか、ゴールの盤面を見せること", () => {
      const title = screen.getByRole("heading", { name: "スライドパズル" });
      const purpose = screen.getByText(
        "番号が書かれたタイルをスライドさせて、順番に並べるパズルです",
      );
      const positions = [getTilePosition(1), getTilePosition(8)];

      expect(title).toBeTruthy();
      expect(purpose).toBeTruthy();
      expect(positions).toEqual(["1行1列", "3行2列"]);
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      render(<SlidePuzzleTutorial open={true} onClose={onClose} />);
    });

    test("最初の画面で、何をするパズルかとゴールの盤面を、ゴールの一言と一緒に見せること", () => {
      const purpose = screen.getByText(
        "番号が書かれたタイルをスライドさせて、順番に並べるパズルです",
      );
      const caption = screen.getByText("この形がゴールです");
      const position = getTilePosition(1);

      expect(purpose).toBeTruthy();
      expect(caption).toBeTruthy();
      expect(position).toBe("1行1列");
    });

    test("ゴールを見せた後に、始まりの一言を添えて崩れた始めの盤面を見せること", () => {
      advanceTime(stillGoalHoldMs);

      const caption = screen.getByText("最初はこのように崩れています");
      const position = getTilePosition(1);

      expect(caption).toBeTruthy();
      expect(position).toBe("1行2列");
    });

    test("最後まで見せると、最初の手順の一言と印を出すこと", () => {
      advanceTime(stillGoalHoldMs);
      advanceTime(introEnoughMs);

      const headline = screen.getByText(
        "空白の隣のタイルをタップすると 空白にスライドします",
      );
      const hinted = getCuedTiles("hint");

      expect(headline).toBeTruthy();
      expect(hinted).toEqual(["5"]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<SlidePuzzleTutorial open={true} onClose={onClose} />);
      skipIntro();
    });

    test("並べ終えると、プレイに戻ることを伝え、プレイに戻る操作で閉じること", () => {
      tapTiles([...stepTiles, ...remainingTiles]);
      const detail = screen.getByText(
        "プレイ中の盤面も同じルールで ほかのタイルをどかしながら並べます",
      );
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(detail).toBeTruthy();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});

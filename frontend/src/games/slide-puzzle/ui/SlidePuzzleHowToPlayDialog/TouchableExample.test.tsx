import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { ReactElement } from "react";

import { HowToPlayExamplePanel } from "@/components/HowToPlayExamplePanel";
import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
} from "@/games/slide-puzzle/puzzle/rules";
import type { SlidePuzzleBoard } from "@/games/slide-puzzle/puzzle/state";
import {
  carryRuleExamples,
  lineRuleExample,
  solvedRuleExamples,
  tapOperationExample,
} from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/figure-boards";
import { TouchableExample } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/TouchableExample";
import { playLayeredSound, playSound } from "@/lib/audio/sound-effects";

vi.mock("@/lib/audio/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

/** 揺れとクリアの波。終わったことにして、完了を待つ処理をすぐ進める。 */
const animate = vi.fn(function createFinishedAnimation(): Animation {
  return {
    finished: Promise.resolve(),
    cancel: vi.fn(),
  } as unknown as Animation;
});

beforeEach(() => {
  animate.mockClear();
  Element.prototype.animate = animate as unknown as Element["animate"];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
  Reflect.deleteProperty(Element.prototype, "animate");
});

/** 本番と同じく、元に戻すボタンを持つ例の面に置いて描く。 */
function renderInPanel(example: ReactElement): void {
  render(<HowToPlayExamplePanel resettable>{example}</HowToPlayExamplePanel>);
}

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "盤面" });
}

function getTile(tile: number): HTMLElement {
  return within(getBoard()).getByRole("button", { name: String(tile) });
}

function pressTile(tile: number): void {
  fireEvent.click(getTile(tile));
}

/** 本番の盤面部品がタイルを置いた位置から読む、今の盤面。 */
function readBoard(): number[] {
  const tiles = within(getBoard()).getAllByRole("button");
  const size = Math.round(Math.sqrt(tiles.length + 1));
  const board = Array.from({ length: size * size }, () => 0);
  for (const tile of tiles) {
    const [column = 0, row = 0] = (
      tile.style.transform.match(/\d+/g) ?? []
    ).map((value) => Number(value) / 100);
    board[row * size + column] = Number(tile.textContent);
  }
  return board;
}

function listHintedTiles(): number[] {
  return within(getBoard())
    .getAllByRole("button")
    .filter(
      (tile) => tile.querySelector("[data-how-to-play-press-hint]") !== null,
    )
    .map((tile) => Number(tile.textContent));
}

function readTileVerdicts(): Record<number, string | null> {
  return Object.fromEntries(
    within(getBoard())
      .getAllByRole("button")
      .map((tile) => [
        Number(tile.textContent),
        tile
          .querySelector("[data-how-to-play-verdict-mark]")
          ?.getAttribute("data-how-to-play-verdict-mark") ?? null,
      ]),
  );
}

/** 本番の判定で求めた、タイルごとのスライドするか。 */
function judgeTiles(board: SlidePuzzleBoard): Record<number, string> {
  return Object.fromEntries(
    board.flatMap((tile, cellIndex) =>
      tile === 0
        ? []
        : [
            [
              tile,
              getSlidePuzzleSlide(board, cellIndex) === null
                ? "disallowed"
                : "allowed",
            ],
          ],
    ),
  );
}

function slideTile(board: SlidePuzzleBoard, tile: number): SlidePuzzleBoard {
  const slide = getSlidePuzzleSlide(board, board.indexOf(tile));
  return slide === null ? board : applySlidePuzzleSlide(board, slide);
}

function queryResetButton(): HTMLButtonElement | null {
  return screen.queryByRole<HTMLButtonElement>("button", {
    name: "例を元に戻す",
  });
}

function playedSoundUrls(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => (sound as unknown as { url: string }).url);
}

describe("TouchableExample", () => {
  describe("どのタイルがスライドするかの札を添える場合", () => {
    const { board, hintTiles } = lineRuleExample;
    const [hintTile] = hintTiles;
    const boardAfterHint = slideTile(board, hintTile ?? 0);
    const stayingTile = 1;

    beforeEach(() => {
      renderInPanel(
        <TouchableExample example={lineRuleExample} caption="tile-verdicts" />,
      );
    });

    test("最初は、どのタイルにも本番の判定の札を付け、手がかりを最初の手に付けること", () => {
      const verdicts = readTileVerdicts();
      const hinted = listHintedTiles();
      const legend = screen.queryByRole("figure", {
        name: "スライドする、スライドしない",
      });

      expect(verdicts).toEqual(judgeTiles(board));
      expect(hinted).toEqual([hintTile]);
      expect(legend).not.toBeNull();
    });

    test("手がかりのタイルを押すと、本番の遷移でスライドさせ、札を今の盤面から付け直し、手がかりを消すこと", () => {
      pressTile(hintTile ?? 0);

      const shownBoard = readBoard();
      const verdicts = readTileVerdicts();
      const hinted = listHintedTiles();
      const resetButton = queryResetButton();

      expect(shownBoard).toEqual(boardAfterHint);
      expect(verdicts).toEqual(judgeTiles(boardAfterHint));
      expect(hinted).toEqual([]);
      expect(playedSoundUrls()).toEqual([expect.stringContaining("slid")]);
      expect(resetButton?.disabled).toBe(false);
    });

    test("✕ の札のタイルを押すと、盤面を変えずに本番と同じく揺らして鳴らし、手がかりを消すこと", () => {
      pressTile(stayingTile);

      const shownBoard = readBoard();
      // 札は揺れるタイルの面の中に置き、面と一緒に揺らす。
      const shakenTile = (animate.mock.contexts[0] as Element | undefined)
        ?.querySelector("[data-how-to-play-verdict-mark]")
        ?.closest("button")?.textContent;
      const hinted = listHintedTiles();
      const resetButton = queryResetButton();

      expect(shownBoard).toEqual([...board]);
      expect(animate).toHaveBeenCalledTimes(1);
      expect(shakenTile).toBe(String(stayingTile));
      expect(playedSoundUrls()).toEqual([expect.stringContaining("invalid")]);
      expect(hinted).toEqual([]);
      expect(resetButton?.disabled).toBe(true);
    });

    test("スライドさせて最初の盤面に戻すと、手がかりを付け直し、元に戻すボタンを隠すこと", () => {
      pressTile(hintTile ?? 0);
      pressTile(hintTile ?? 0);

      const shownBoard = readBoard();
      const hinted = listHintedTiles();
      const resetButton = queryResetButton();

      expect(shownBoard).toEqual([...board]);
      expect(hinted).toEqual([hintTile]);
      expect(resetButton?.disabled).toBe(true);
    });

    test("元に戻すボタンで、最初の盤面と手がかりに戻すこと", () => {
      pressTile(4);
      pressTile(5);
      fireEvent.click(queryResetButton() as HTMLButtonElement);

      const shownBoard = readBoard();
      const hinted = listHintedTiles();

      expect(shownBoard).toEqual([...board]);
      expect(hinted).toEqual([hintTile]);
    });
  });

  describe.each([
    [
      "隣のタイル",
      carryRuleExamples[0],
      "1枚がスライドする",
      "1枚がスライドした",
    ],
    [
      "離れたタイル",
      carryRuleExamples[1],
      "2枚がスライドする",
      "2枚がスライドした",
    ],
  ] as const)("%sを押して動く枚数を言う場合", (_, example, predicted, slid) => {
    const [hintTile] = example.hintTiles;
    const boardAfterHint = slideTile(example.board, hintTile);
    const stayingTile = 5;

    beforeEach(() => {
      renderInPanel(<TouchableExample example={example} caption="carry" />);
    });

    test("押す前は、手がかりのタイルを押すとスライドする枚数を言うこと", () => {
      const figure = screen.getByRole("figure");
      const namedFigure = screen.queryByRole("figure", { name: predicted });

      expect(namedFigure).toBe(figure);
    });

    test("押した後は、本番の遷移でスライドした枚数を言うこと", () => {
      pressTile(hintTile);

      const shownBoard = readBoard();
      const namedFigure = screen.queryByRole("figure", { name: slid });

      expect(shownBoard).toEqual(boardAfterHint);
      expect(namedFigure).not.toBeNull();
    });

    test("空白と同じ行・列にないタイルを押すと、✕ とそのわけを言うこと", () => {
      pressTile(stayingTile);

      const namedFigure = screen.queryByRole("figure", {
        name: "スライドしない・空白と同じ行・列にない",
      });
      const hinted = listHintedTiles();

      expect(namedFigure).not.toBeNull();
      expect(hinted).toEqual([]);
    });
  });

  describe("完成した盤面で完成かを判定する場合", () => {
    const [solvedExample] = solvedRuleExamples;

    beforeEach(() => {
      renderInPanel(
        <TouchableExample example={solvedExample} caption="solved" />,
      );
    });

    test("最初は ✓ 完成とし、完成を崩す手を誘う手がかりを付けないこと", () => {
      const figure = screen.queryByRole("figure", { name: "完成" });
      const hinted = listHintedTiles();

      expect(figure).not.toBeNull();
      expect(hinted).toEqual([]);
    });

    test("8 を押すと ✕ 未完成になり、押し戻して完成させると本番のクリアの波と音を返すこと", () => {
      pressTile(8);
      const unsolvedFigure = screen.queryByRole("figure", { name: "未完成" });
      pressTile(8);

      const solvedFigure = screen.queryByRole("figure", { name: "完成" });

      expect(unsolvedFigure).not.toBeNull();
      expect(solvedFigure).not.toBeNull();
      expect(animate).toHaveBeenCalledTimes(8);
      expect(playLayeredSound).toHaveBeenCalledTimes(1);
    });

    test("空白と同じ行・列にないタイルを押すと、✓ 完成のまま判定の下に破ったルールを添えること", () => {
      pressTile(1);

      const figure = screen.queryByRole("figure", {
        name: "完成・空白と同じ行・列にない",
      });

      expect(figure).not.toBeNull();
    });
  });

  describe("番号順でも空白が右下にない盤面で完成かを判定する場合", () => {
    const [, unsolvedExample] = solvedRuleExamples;

    beforeEach(() => {
      renderInPanel(
        <TouchableExample example={unsolvedExample} caption="solved" />,
      );
    });

    test("最初から ✕ 未完成とし、手がかりを付けないこと", () => {
      const figure = screen.queryByRole("figure", { name: "未完成" });
      const hinted = listHintedTiles();

      expect(figure).not.toBeNull();
      expect(hinted).toEqual([]);
    });
  });

  describe("言葉を添えない動かし方の例の場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      renderInPanel(<TouchableExample example={tapOperationExample} />);
    });

    test("手がかりを押した順に次の手へ移し、完成させるとクリアの波を返し終えて手がかりを消すこと", async () => {
      const hintedBefore = listHintedTiles();
      pressTile(5);
      const hintedAfterFirst = listHintedTiles();
      pressTile(8);
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const shownBoard = readBoard();
      const hintedAfterSolved = listHintedTiles();
      const disabled = getTile(8).hasAttribute("disabled");

      expect(hintedBefore).toEqual([5]);
      expect(hintedAfterFirst).toEqual([8]);
      expect(shownBoard).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0]);
      expect(hintedAfterSolved).toEqual([]);
      expect(playLayeredSound).toHaveBeenCalledTimes(1);
      expect(disabled).toBe(false);
    });
  });
});

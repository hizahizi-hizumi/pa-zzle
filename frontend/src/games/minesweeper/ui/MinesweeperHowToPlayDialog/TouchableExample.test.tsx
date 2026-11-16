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
  chordOperationExample,
  completionRuleExample,
  flagOperationExample,
  mineCountRuleExample,
  numberRuleExample,
} from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/figure-boards";
import { TouchableExample } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/TouchableExample";
import { playLayeredSound, playSound } from "@/lib/audio/sound-effects";

vi.mock("@/lib/audio/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
});

/** 本番と同じく、元に戻すボタンを持つ例の面に置いて描く。 */
function renderInPanel(example: ReactElement): void {
  render(<HowToPlayExamplePanel resettable>{example}</HowToPlayExamplePanel>);
}

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "マインスイーパー盤面" });
}

/** 本番の盤面と同じ読み上げ名（マス N …）で、マスを探す。N は1から数える。 */
function getCell(cellNumber: number): HTMLButtonElement {
  return within(getBoard()).getByRole<HTMLButtonElement>("button", {
    name: new RegExp(`^マス ${cellNumber} `),
  });
}

/** 押す所の手がかりを付けたマスの番号（1から数える）。 */
function listHintedCellNumbers(): number[] {
  return Array.from(
    getBoard().querySelectorAll<HTMLElement>("[data-cell-index]"),
  ).flatMap((cell) =>
    cell.querySelector("[data-how-to-play-press-hint]") === null
      ? []
      : [Number(cell.dataset.cellIndex) + 1],
  );
}

/** マスの札。マスの番号（1から数える）と、✓（allowed: 地雷なし）か ✕（disallowed: 地雷あり）か。 */
function listCandidates(): [number, string | undefined][] {
  return Array.from(
    getBoard().querySelectorAll<HTMLElement>("[data-how-to-play-verdict-mark]"),
  ).map((mark) => [
    Number(mark.closest<HTMLElement>("[data-cell-index]")?.dataset.cellIndex) +
      1,
    mark.dataset.howToPlayVerdictMark,
  ]);
}

/** 例の下で入れ替える言葉の層のうち、見せている層の名前（隠した層の中の層は数えない）。外側の層から順に並べる。 */
function listShownCaptionLayers(): (string | undefined)[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-how-to-play-caption-layer]"),
  )
    .filter((layer) => layer.closest('[aria-hidden="true"]') === null)
    .map((layer) => layer.dataset.howToPlayCaptionLayer);
}

function getResetButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "例を元に戻す",
  });
}

describe("TouchableExample", () => {
  describe("数字のルールの例の場合", () => {
    beforeEach(() => {
      renderInPanel(
        <TouchableExample example={numberRuleExample} caption="candidates" />,
      );
    });

    test("閉じたマスごとに札を付け、地雷ではない最初のマスに手がかりを付けること", () => {
      const candidates = listCandidates();
      const hinted = listHintedCellNumbers();

      expect(candidates).toEqual([
        [2, "disallowed"],
        [3, "disallowed"],
        [4, "allowed"],
        [8, "allowed"],
      ]);
      expect(hinted).toEqual([4]);
      expect(listShownCaptionLayers()).toEqual(["legend", "both"]);
      expect(getResetButton().disabled).toBe(true);
    });

    test("手がかりのマスを押すと、本番と同じに開いて音を鳴らし、手がかりを次のマスへ移すこと", () => {
      fireEvent.click(getCell(4));

      expect(getCell(4).getAttribute("aria-label")).toBe("マス 4 開示済み 1");
      expect(playLayeredSound).toHaveBeenCalledTimes(1);
      expect(listHintedCellNumbers()).toEqual([8]);
      expect(getResetButton().disabled).toBe(false);
    });

    test("✕ のマスを押すと、本番と同じに地雷を踏んで札を消し、踏んだ音を鳴らすこと", () => {
      fireEvent.click(getCell(2));

      expect(getCell(2).getAttribute("aria-label")).toBe("マス 2 踏んだ地雷");
      expect(listCandidates().map(([cell]) => cell)).toEqual([3, 4, 8]);
      expect(playSound).toHaveBeenCalledTimes(1);
    });

    test("開いた数字を押しても、旗の数がそろわなければ何も起こさないこと", () => {
      fireEvent.click(getCell(1));

      expect(playLayeredSound).not.toHaveBeenCalled();
      expect(getResetButton().disabled).toBe(true);
    });

    test("地雷ではないマスをすべて開くと、残りの地雷を見せて完成と言い、それ以上は押せないこと", () => {
      fireEvent.click(getCell(4));
      fireEvent.click(getCell(8));

      expect(listShownCaptionLayers()).toEqual(["cleared", "allowed"]);
      expect(screen.queryByRole("figure", { name: "完成" })).not.toBeNull();
      expect(getCell(2).getAttribute("aria-label")).toBe("マス 2 地雷");
      expect(getCell(2).disabled).toBe(true);
      expect(listHintedCellNumbers()).toEqual([]);
    });

    describe("手がかりのマスを開いた場合", () => {
      beforeEach(() => {
        fireEvent.click(getCell(4));
      });

      test("元に戻すと、最初の姿に戻ること", () => {
        fireEvent.click(getResetButton());

        expect(getCell(4).getAttribute("aria-label")).toBe("マス 4 未開示");
        expect(listHintedCellNumbers()).toEqual([4]);
        expect(getResetButton().disabled).toBe(true);
      });
    });
  });

  describe("地雷の数のルールの例の場合", () => {
    beforeEach(() => {
      renderInPanel(
        <TouchableExample
          example={mineCountRuleExample}
          caption="candidates"
          showsMineCount
        />,
      );
    });

    test("盤面全体の地雷の数を、プレイ画面と同じ呼び名で添え、数字の届かない左上から手がかりを付けること", () => {
      const mineCount = screen.getByText("地雷 1");
      const hinted = listHintedCellNumbers();

      expect(mineCount).toBeTruthy();
      expect(hinted).toEqual([1]);
    });
  });

  describe("完成のルールの例の場合", () => {
    beforeEach(() => {
      renderInPanel(
        <TouchableExample
          example={completionRuleExample}
          caption="completion"
        />,
      );
    });

    test("最初は途中と言うこと", () => {
      const figure = screen.queryByRole("figure", { name: "途中" });

      expect(figure).not.toBeNull();
    });

    test("閉じたマスは押すマスだけで、そこに手がかりを付けること", () => {
      const hidden = getBoard().querySelectorAll('[data-cell-state="hidden"]');

      expect(hidden).toHaveLength(1);
      expect(listHintedCellNumbers()).toEqual([4]);
    });

    test("旗のマスを押しても、本番と同じく開かずに何も起こさないこと", () => {
      fireEvent.click(getCell(3));

      expect(getCell(3).getAttribute("aria-label")).toBe("マス 3 旗");
      expect(playSound).not.toHaveBeenCalled();
    });

    test("最後のマスを開くと、踏んだ地雷と旗を残したまま完成と言うこと", () => {
      fireEvent.click(getCell(4));

      expect(screen.queryByRole("figure", { name: "完成" })).not.toBeNull();
      expect(getCell(2).getAttribute("aria-label")).toBe("マス 2 踏んだ地雷");
      expect(getCell(3).getAttribute("aria-label")).toBe("マス 3 旗");
    });
  });

  describe("旗に切り替える例の場合", () => {
    beforeEach(() => {
      renderInPanel(
        <TouchableExample example={flagOperationExample} showsModeToggle />,
      );
    });

    function getModeToggle(): HTMLElement {
      return screen.getByRole("button", { name: "旗モード" });
    }

    /** 盤面の外（旗の切り替えのボタンの台）に付けた手がかり。 */
    function queryToggleHint(): Element | undefined {
      return Array.from(
        document.querySelectorAll("[data-how-to-play-press-hint]"),
      ).find((hint) => !getBoard().contains(hint));
    }

    test("最初は旗の切り替えのボタンに手がかりを付け、マスには付けないこと", () => {
      const toggleHint = queryToggleHint();
      const hinted = listHintedCellNumbers();

      expect(toggleHint).toBeTruthy();
      expect(hinted).toEqual([]);
    });

    test("旗に切り替えると、手がかりを旗を置くマスへ移し、元に戻すボタンを出すこと", () => {
      fireEvent.click(getModeToggle());

      expect(getModeToggle().getAttribute("aria-pressed")).toBe("true");
      expect(listHintedCellNumbers()).toEqual([2]);
      expect(getResetButton().disabled).toBe(false);
    });

    test("旗に切り替えてマスを押すと、本番と同じに旗を置いて音を鳴らし、もう一度押すと外すこと", () => {
      fireEvent.click(getModeToggle());
      fireEvent.click(getCell(2));
      const placed = getCell(2).getAttribute("aria-label");
      fireEvent.click(getCell(2));

      expect(placed).toBe("マス 2 旗");
      expect(getCell(2).getAttribute("aria-label")).toBe("マス 2 未開示");
      expect(playSound).toHaveBeenCalledTimes(2);
    });

    test("切り替える前に旗を置くマスを押すと、地雷を踏まずに開き、ボタンにもマスにも手がかりを出さないこと", () => {
      fireEvent.click(getCell(2));

      expect(getCell(2).getAttribute("aria-label")).toBe("マス 2 開示済み 2");
      expect(queryToggleHint()).toBeUndefined();
      expect(listHintedCellNumbers()).toEqual([]);
    });

    describe("切り替える前に旗を置くマスを押して開いた場合", () => {
      beforeEach(() => {
        fireEvent.click(getCell(2));
      });

      test("元に戻すと、ボタンの手がかりを出し直すこと", () => {
        fireEvent.click(getResetButton());

        expect(getCell(2).getAttribute("aria-label")).toBe("マス 2 未開示");
        expect(queryToggleHint()).toBeDefined();
        expect(listHintedCellNumbers()).toEqual([]);
      });
    });
  });

  describe("旗の置き方の例で、切り替えずに長押しする場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      renderInPanel(
        <TouchableExample example={flagOperationExample} showsModeToggle />,
      );
    });

    test("切り替えなくても、本番と同じに旗を置いて手がかりを消すこと", () => {
      fireEvent.pointerDown(getCell(2), { button: 0 });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.pointerUp(getCell(2));
      fireEvent.click(getCell(2));

      expect(getCell(2).getAttribute("aria-label")).toBe("マス 2 旗");
      expect(
        document.querySelector("[data-how-to-play-press-hint]"),
      ).toBeNull();
    });
  });

  describe("まとめて開く例の場合", () => {
    beforeEach(() => {
      renderInPanel(<TouchableExample example={chordOperationExample} />);
    });

    test("1に手がかりを付けること", () => {
      const hinted = listHintedCellNumbers();

      expect(hinted).toEqual([6]);
    });

    test("旗を外すと、押しても開かない1の手がかりを消し、旗を置き直すと出し直すこと", () => {
      // 本番の右クリックと同じく、押し下げてから右クリックの知らせを送る。
      fireEvent.pointerDown(getCell(2), { button: 2 });
      fireEvent.contextMenu(getCell(2));
      const whileRemoved = listHintedCellNumbers();
      fireEvent.pointerDown(getCell(2), { button: 2 });
      fireEvent.contextMenu(getCell(2));

      expect(whileRemoved).toEqual([]);
      expect(listHintedCellNumbers()).toEqual([6]);
    });

    test("1を押すと、本番と同じに周りの残りを開いて音を鳴らし、手がかりを消すこと", () => {
      fireEvent.click(getCell(6));

      expect(getCell(1).getAttribute("aria-label")).toBe("マス 1 開示済み 1");
      expect(playLayeredSound).toHaveBeenCalledTimes(1);
      expect(listHintedCellNumbers()).toEqual([]);
    });
  });

  describe("右クリックの例の場合", () => {
    beforeEach(() => {
      renderInPanel(
        <TouchableExample
          example={flagOperationExample}
          hintPress="secondary-press"
        />,
      );
    });

    test("手がかりにマウスの右ボタンの押し方を付けること", () => {
      const hint = getBoard().querySelector("[data-how-to-play-press-hint]");

      expect(hint?.querySelector(".lucide-mouse-right")).not.toBeNull();
    });

    test("右クリックで、本番と同じに旗を置くこと", () => {
      fireEvent.contextMenu(getCell(2));

      expect(getCell(2).getAttribute("aria-label")).toBe("マス 2 旗");
    });
  });
});

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { TakuzuTutorial } from "@/games/takuzu/ui/TakuzuTutorial";

afterEach(cleanup);

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "バイナリパズル盤面" });
}

function getCell(row: number, column: number): HTMLElement {
  return within(getBoard()).getByRole("button", {
    name: new RegExp(`^${row}行${column}列 `),
  });
}

function tapCell(row: number, column: number): void {
  fireEvent.click(getCell(row, column));
}

/** 指示どおりに、最後のステップの手前まで進める。5 は一度同じ並びを作ってから直す。 */
function followGuidedSteps(): void {
  tapCell(1, 3);
  tapCell(1, 3);
  tapCell(3, 3);
  tapCell(3, 3);
  tapCell(3, 4);
  tapCell(3, 4);
  tapCell(1, 2);
  tapCell(1, 4);
  tapCell(1, 4);
  tapCell(1, 2);
  tapCell(1, 4);
  tapCell(1, 4);
  tapCell(2, 3);
}

/** 残りのマスを解のとおりに埋める（2行1列 丸・2行2列 四角・2行4列 丸・4行1列 丸・4行3列 四角・4行4列 四角）。 */
function fillRemainingCells(): void {
  tapCell(2, 1);
  tapCell(2, 1);
  tapCell(2, 2);
  tapCell(2, 4);
  tapCell(2, 4);
  tapCell(4, 1);
  tapCell(4, 1);
  tapCell(4, 3);
  tapCell(4, 4);
}

describe("TakuzuTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onClose = vi.fn<() => void>();
  });

  describe("難易度選択から開いた場合", () => {
    let rerenderTutorial: (open: boolean) => void;

    beforeEach(() => {
      const { rerender } = render(
        <TakuzuTutorial
          open={true}
          origin="difficulty-selection"
          onClose={onClose}
        />,
      );
      rerenderTutorial = (open) =>
        rerender(
          <TakuzuTutorial
            open={open}
            origin="difficulty-selection"
            onClose={onClose}
          />,
        );
    });

    test("最初の指示を表示すること", () => {
      const instruction = screen.getByText(
        "このマスをタップして、四角を置こう。",
      );

      expect(instruction).toBeTruthy();
    });

    test("指示したマスだけを操作対象として示すこと", () => {
      const targets = within(getBoard())
        .getAllByRole("button", { name: /操作対象/ })
        .map((cell) => cell.getAttribute("aria-label"));

      expect(targets).toEqual(["1行3列 空き 操作対象"]);
    });

    test("指示していないマスを押しても盤面と指示が変わらないこと", () => {
      tapCell(2, 1);

      const cell = getCell(2, 1).getAttribute("aria-label");
      const instruction = screen.getByText(
        "このマスをタップして、四角を置こう。",
      );

      expect(cell).toBe("2行1列 空き");
      expect(instruction).toBeTruthy();
    });

    test("指示したマスを押すと四角が置かれ、次の指示へ進むこと", () => {
      tapCell(1, 3);

      const cell = getCell(1, 3).getAttribute("aria-label");
      const instruction = screen.getByText(
        "もう一度タップして、丸に変えよう。",
      );
      const progress = screen.getByRole("progressbar", {
        name: "チュートリアルの進み具合",
      });

      expect(cell).toBe("1行3列 四角 操作対象");
      expect(instruction).toBeTruthy();
      expect(progress.getAttribute("aria-valuenow")).toBe("1");
    });

    test("指示どおりに進めると最後に盤面を自由に埋めるステップになること", () => {
      followGuidedSteps();

      const instruction = screen.getByText("残りのマスを埋めて完成させよう。");
      const targets = within(getBoard()).queryAllByRole("button", {
        name: /操作対象/,
      });

      expect(instruction).toBeTruthy();
      expect(targets).toEqual([]);
    });

    test("盤面を完成させると完成を示し、遊んでみるで閉じることを通知すること", () => {
      followGuidedSteps();
      fillRemainingCells();
      const completion = screen.getByText("完成！");
      fireEvent.click(screen.getByRole("button", { name: "遊んでみる" }));

      expect(completion).toBeTruthy();
      expect(onClose).toHaveBeenCalledOnce();
    });

    test("閉じてから開き直すと最初のステップから始まること", () => {
      tapCell(1, 3);
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
      rerenderTutorial(false);
      rerenderTutorial(true);

      const instruction = screen.getByText(
        "このマスをタップして、四角を置こう。",
      );

      expect(onClose).toHaveBeenCalledOnce();
      expect(instruction).toBeTruthy();
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<TakuzuTutorial open={true} origin="play" onClose={onClose} />);
    });

    test("盤面を完成させるとプレイに戻る操作を出すこと", () => {
      followGuidedSteps();
      fillRemainingCells();
      const back = screen.getByRole("button", { name: "プレイに戻る" });

      expect(back).toBeTruthy();
    });
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { NanpureBoard as NanpureBoardState } from "@/games/nanpure/puzzle/board";
import type { NanpureNotes } from "@/games/nanpure/session/session";
import type { NanpureBoardSpotlight } from "@/games/nanpure/ui/board/board-spotlight";
import type { NanpureCellCue } from "@/games/nanpure/ui/board/cell-cue";
import { NanpureBoard } from "@/games/nanpure/ui/board/NanpureBoard";

afterEach(cleanup);

function emptyBoard(): NanpureBoardState {
  return Array.from({ length: 81 }, () => null);
}

function emptyNotes(): NanpureNotes {
  return Array.from({ length: 81 }, () => []);
}

function renderTutorialBoard({
  cues = [],
  spotlight = null,
}: {
  cues?: readonly NanpureCellCue[];
  spotlight?: NanpureBoardSpotlight | null;
}): void {
  render(
    <NanpureBoard
      board={emptyBoard()}
      clues={emptyBoard()}
      notes={emptyNotes()}
      selectedCellIndex={null}
      conflictCellIndices={[]}
      mistakeCellIndices={[]}
      cues={cues}
      spotlight={spotlight}
      onSelectCell={vi.fn()}
    />,
  );
}

function getCell(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

function querySpotlightArea(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-tutorial-spotlight-area]");
}

describe("NanpureBoard", () => {
  test("初期ヒントとプレイヤー入力と手動メモを盤面へ表示すること", () => {
    const clues = [...emptyBoard()];
    clues[0] = 5;
    const board = [...clues];
    board[1] = 3;
    const notes = [...emptyNotes()];
    notes[2] = [1, 4];

    render(
      <NanpureBoard
        board={board}
        clues={clues}
        notes={notes}
        selectedCellIndex={null}
        conflictCellIndices={[]}
        mistakeCellIndices={[]}
        onSelectCell={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "1行1列、5、初期ヒント" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "1行2列、3" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "1行3列、空き、メモ 1、4" }),
    ).toBeTruthy();
  });

  test("マス選択をセル番号で通知すること", () => {
    const onSelectCell = vi.fn();
    render(
      <NanpureBoard
        board={emptyBoard()}
        clues={emptyBoard()}
        notes={emptyNotes()}
        selectedCellIndex={null}
        conflictCellIndices={[]}
        mistakeCellIndices={[]}
        onSelectCell={onSelectCell}
      />,
    );
    const cell = screen.getByRole("button", { name: "1行2列、空き" });

    fireEvent.click(cell);

    expect(onSelectCell).toHaveBeenCalledWith(1);
  });

  test("競合するマスを利用者から識別できる状態にすること", () => {
    const board = [...emptyBoard()];
    board[0] = 5;
    board[1] = 5;
    render(
      <NanpureBoard
        board={board}
        clues={emptyBoard()}
        notes={emptyNotes()}
        selectedCellIndex={null}
        conflictCellIndices={[0, 1]}
        mistakeCellIndices={[]}
        onSelectCell={vi.fn()}
      />,
    );
    const conflict = screen.getByRole("button", { name: "1行1列、5、競合" });

    const invalid = conflict.getAttribute("aria-invalid");

    expect(invalid).toBe("true");
  });

  test("競合しない誤答も利用者から識別できる状態にすること", () => {
    const board = [...emptyBoard()];
    board[0] = 3;
    render(
      <NanpureBoard
        board={board}
        clues={emptyBoard()}
        notes={emptyNotes()}
        selectedCellIndex={null}
        conflictCellIndices={[]}
        mistakeCellIndices={[0]}
        onSelectCell={vi.fn()}
      />,
    );
    const mistake = screen.getByRole("button", { name: "1行1列、3、誤り" });

    const invalid = mistake.getAttribute("aria-invalid");

    expect(invalid).toBe("true");
  });

  describe("抜く所を受け取った場合", () => {
    const spotlight: NanpureBoardSpotlight = {
      cellIndices: [80],
      units: [{ kind: "row", index: 0 }],
    };

    beforeEach(() => {
      renderTutorialBoard({ spotlight });
    });

    test("盤面の要素を覆う範囲として示し、受け取ったマスと行を抜くこと", () => {
      const areaCoversBoard =
        querySpotlightArea()?.contains(getCell("1行1列、空き")) ?? false;
      const spotlitCell = getCell("9行9列、空き").querySelector(
        "[data-tutorial-spotlight]",
      );
      const spotlitUnits = Array.from(
        document.querySelectorAll<HTMLElement>("[data-spotlit-unit]"),
      ).map((element) => element.dataset.spotlitUnit);

      expect(areaCoversBoard).toBe(true);
      expect(spotlitCell).not.toBeNull();
      expect(spotlitUnits).toEqual(["row:0"]);
    });
  });

  describe("抜く所を受け取らない場合", () => {
    beforeEach(() => {
      renderTutorialBoard({});
    });

    test("盤面を覆う範囲として示さず、どこも抜かないこと", () => {
      const area = querySpotlightArea();
      const spotlit = document.querySelector("[data-tutorial-spotlight]");

      expect(area).toBeNull();
      expect(spotlit).toBeNull();
    });
  });

  describe("印を付ける場合", () => {
    const cues: readonly NanpureCellCue[] = [
      { cellIndex: 0, kind: "hint", id: 0 },
      { cellIndex: 1, kind: "recall", id: 1 },
    ];

    beforeEach(() => {
      renderTutorialBoard({ cues });
    });

    test("印のマスには指を出さず、印だけを出すこと", () => {
      const marks = ["1行1列、空き", "1行2列、空き"].map((label) =>
        getCell(label).querySelector('[data-tutorial-cue="mark"]'),
      );
      const pointer = document.querySelector('[data-tutorial-cue="pointer"]');

      expect(marks.every((mark) => mark !== null)).toBe(true);
      expect(pointer).toBeNull();
    });
  });
});

import { createNanpureExampleSession } from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-board";
import {
  createNanpureExampleHintProgress,
  findNanpureExampleHint,
  followNanpureExampleHint,
  type NanpureExampleGroupState,
  type NanpureExamplePress,
} from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-hint";

const region = { row: 0, column: 0, rowCount: 3, columnCount: 3 };
const session = createNanpureExampleSession({
  region,
  rows: ["6 . 8", "3 . 1", "7 2 4"],
});
const changed = createNanpureExampleSession({
  region,
  rows: ["6 . 8", "3 +9 1", "7 2 4"],
});
const otherChange = createNanpureExampleSession({
  region,
  rows: ["6 +4 8", "3 . 1", "7 2 4"],
});

const hintedCell: NanpureExamplePress = {
  kind: "cell",
  board: 0,
  cellIndex: 10,
};
const otherCell: NanpureExamplePress = { kind: "cell", board: 0, cellIndex: 1 };
const hintedDigit: NanpureExamplePress = { kind: "digit", digit: 9 };
const hints = [hintedCell, hintedDigit] as const;

const initial: NanpureExampleGroupState = {
  sessions: [session],
  selection: null,
  notesMode: false,
};
const hintedCellSelected: NanpureExampleGroupState = {
  ...initial,
  selection: { board: 0, cellIndex: 10 },
};
const otherCellSelected: NanpureExampleGroupState = {
  ...initial,
  selection: { board: 0, cellIndex: 1 },
};
const start = createNanpureExampleHintProgress(initial);

describe("findNanpureExampleHint", () => {
  const afterCell = followNanpureExampleHint(
    hints,
    start,
    hintedCell,
    hintedCellSelected,
    initial,
  );

  test("最初は、最初の手のマスを示すこと", () => {
    const hint = findNanpureExampleHint(hints, start, initial);

    expect(hint).toEqual(hintedCell);
  });

  test("手がかりのマスを選ぶと、次の手のボタンを示すこと", () => {
    const hint = findNanpureExampleHint(hints, afterCell, hintedCellSelected);

    expect(hint).toEqual(hintedDigit);
  });

  describe("ボタンを示した後に別のマスを選び直した場合", () => {
    const progress = followNanpureExampleHint(
      hints,
      afterCell,
      otherCell,
      otherCellSelected,
      initial,
    );

    test("選ぶマスに手がかりを戻すこと", () => {
      const hint = findNanpureExampleHint(hints, progress, otherCellSelected);

      expect(hint).toEqual(hintedCell);
    });
  });

  describe("手がかりの手を押し終えた場合", () => {
    const next: NanpureExampleGroupState = {
      ...hintedCellSelected,
      sessions: [changed],
    };
    const progress = followNanpureExampleHint(
      hints,
      afterCell,
      hintedDigit,
      next,
      initial,
    );

    test("手がかりを出さないこと", () => {
      const hint = findNanpureExampleHint(hints, progress, next);

      expect(hint).toBeNull();
    });
  });
});

describe("followNanpureExampleHint", () => {
  describe("ほかの手で盤面を変えた場合", () => {
    const offTrack: NanpureExampleGroupState = {
      ...otherCellSelected,
      sessions: [otherChange],
    };
    const offTrackProgress = followNanpureExampleHint(
      hints,
      start,
      { kind: "digit", digit: 4 },
      offTrack,
      initial,
    );

    test("手がかりを出さないこと", () => {
      const hint = findNanpureExampleHint(hints, offTrackProgress, offTrack);

      expect(hint).toBeNull();
    });

    test("その後に最初の盤面に戻ると、最初の手から出し直すこと", () => {
      const progress = followNanpureExampleHint(
        hints,
        offTrackProgress,
        { kind: "erase" },
        otherCellSelected,
        initial,
      );

      const hint = findNanpureExampleHint(hints, progress, otherCellSelected);

      expect(hint).toEqual(hintedCell);
    });
  });

  describe("メモをオンにした後に、最初の手のマスを選んだままメモをオフに戻した場合", () => {
    const notesPress: NanpureExamplePress = { kind: "notes" };
    const hintsWithNotes = [hintedCell, notesPress, hintedDigit] as const;
    const notesOn: NanpureExampleGroupState = {
      ...hintedCellSelected,
      notesMode: true,
    };
    const afterCellWithNotes = followNanpureExampleHint(
      hintsWithNotes,
      start,
      hintedCell,
      hintedCellSelected,
      initial,
    );
    const afterNotes = followNanpureExampleHint(
      hintsWithNotes,
      afterCellWithNotes,
      notesPress,
      notesOn,
      initial,
    );

    test("マスを選び直さずに、メモのボタンから出し直すこと", () => {
      const progress = followNanpureExampleHint(
        hintsWithNotes,
        afterNotes,
        notesPress,
        hintedCellSelected,
        initial,
      );

      const hint = findNanpureExampleHint(
        hintsWithNotes,
        progress,
        hintedCellSelected,
      );

      expect(hint).toEqual(notesPress);
    });
  });
});

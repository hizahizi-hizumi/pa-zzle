import type {
  HakoiriMusumePiece,
  HakoiriMusumePieceKind,
} from "@/games/hakoiri-musume/puzzle/board";
import { createHakoiriMusumePlacementCheck } from "@/games/hakoiri-musume/puzzle/rules";
import {
  CELL_SWITCH_INSET,
  FINGER_LEAN_LIMIT,
  findHakoiriMusumeFlickDirection,
  leanHakoiriMusumePieceTowardFinger,
  startHakoiriMusumeFingerTrace,
  traceHakoiriMusumeFinger,
} from "@/games/hakoiri-musume/ui/board/finger-trace";

type RowColumn = readonly [row: number, column: number];

/** 駒の行数・列数・左上の行・列。 */
type PieceSpec = readonly [
  rows: number,
  columns: number,
  row: number,
  column: number,
];

type TraceVector = {
  name: string;
  pieces: readonly PieceSpec[];
  pieceIndex: number;
  /** 駒の左上に足した指の位置（行・列）。 */
  events: readonly RowColumn[];
  /** 駒の左上が通ったマス（行・列）。始めのマスを含む。 */
  visited: readonly RowColumn[];
};

/**
 * スマホ操作の調査（`scripts/research/hakoiri_musume_mobile.py --expected`）が、採った入力処理（隣接だけ・不感帯 0.15・
 * 補間 1/6 刻み）で出した入出力8件。
 */
const vectors: readonly TraceVector[] = [
  {
    name: "1: 狙った所へなぞる",
    pieces: [
      [2, 2, 3, 2],
      [1, 2, 0, 2],
      [2, 1, 3, 1],
      [2, 1, 1, 2],
      [2, 1, 2, 0],
      [2, 1, 1, 1],
      [1, 1, 4, 0],
      [1, 1, 0, 0],
    ],
    pieceIndex: 7,
    events: [
      [-0.068, 0.254],
      [0.013, 0.709],
      [0.082, 0.863],
    ],
    visited: [
      [0, 0],
      [0, 1],
    ],
  },
  {
    name: "2: ふさがれた向きへ押し込む",
    pieces: [
      [2, 2, 0, 1],
      [1, 2, 4, 1],
      [2, 1, 0, 0],
      [2, 1, 1, 3],
      [2, 1, 2, 1],
      [2, 1, 2, 2],
      [1, 1, 4, 0],
      [1, 1, 3, 3],
    ],
    pieceIndex: 7,
    events: [
      [3.021, 3.509],
      [3.014, 3.69],
      [3.082, 4.063],
      [3.061, 4.376],
      [3.033, 4.619],
    ],
    visited: [[3, 3]],
  },
  {
    name: "3: ふさがれた向きへ押し込んでから曲がる",
    pieces: [
      [2, 2, 0, 2],
      [1, 2, 4, 0],
      [2, 1, 0, 0],
      [2, 1, 3, 3],
      [2, 1, 0, 1],
      [2, 1, 3, 2],
      [1, 1, 2, 0],
      [1, 1, 2, 2],
    ],
    pieceIndex: 3,
    events: [
      [2.943, 3.433],
      [3.011, 3.536],
      [3.062, 4.019],
      [3.095, 4.322],
      [2.871, 4.749],
      [2.448, 4.698],
      [2.101, 4.611],
      [2.174, 4.723],
    ],
    visited: [
      [3, 3],
      [2, 3],
    ],
  },
  {
    name: "4: 斜め隣へまっすぐなぞる",
    pieces: [
      [2, 2, 0, 2],
      [1, 2, 2, 2],
      [2, 1, 1, 0],
      [2, 1, 3, 3],
      [2, 1, 3, 0],
      [2, 1, 3, 1],
      [1, 1, 2, 1],
      [1, 1, 1, 1],
    ],
    pieceIndex: 7,
    events: [
      [0.767, 0.673],
      [0.444, 0.553],
      [0.277, 0.261],
      [-0.045, -0.172],
      [-0.125, -0.083],
    ],
    visited: [
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  },
  {
    name: "5: 狙った所へなぞる",
    pieces: [
      [2, 2, 0, 1],
      [1, 2, 2, 1],
      [2, 1, 1, 0],
      [2, 1, 1, 3],
      [2, 1, 3, 0],
      [2, 1, 3, 3],
      [1, 1, 3, 1],
      [1, 1, 4, 2],
    ],
    pieceIndex: 3,
    events: [
      [0.6, 3.035],
      [0.336, 2.949],
      [0.186, 2.882],
    ],
    visited: [
      [1, 3],
      [0, 3],
    ],
  },
  {
    name: "6: ふさがれた向きへ押し込む",
    pieces: [
      [2, 2, 0, 2],
      [1, 2, 4, 0],
      [2, 1, 0, 0],
      [2, 1, 2, 2],
      [2, 1, 0, 1],
      [2, 1, 2, 1],
      [1, 1, 4, 3],
      [1, 1, 3, 0],
      [1, 1, 2, 3],
      [1, 1, 2, 0],
    ],
    pieceIndex: 8,
    events: [
      [1.776, 3.047],
      [1.26, 2.981],
      [0.873, 2.998],
      [0.803, 3.108],
    ],
    visited: [[2, 3]],
  },
  {
    name: "7: ふさがれた向きへ押し込んでから曲がる",
    pieces: [
      [2, 2, 0, 2],
      [1, 2, 4, 2],
      [2, 1, 0, 0],
      [2, 1, 2, 3],
      [2, 1, 2, 1],
      [2, 1, 2, 2],
      [1, 1, 2, 0],
      [1, 1, 4, 0],
      [1, 1, 1, 1],
      [1, 1, 3, 0],
    ],
    pieceIndex: 8,
    events: [
      [1.047, 0.658],
      [1.039, 0.379],
      [1.079, -0.141],
      [1.091, -0.512],
      [1.281, -0.512],
      [1.62, -0.683],
      [1.994, -0.657],
      [2.004, -0.772],
    ],
    visited: [[1, 1]],
  },
  {
    name: "8: 斜め隣へまっすぐなぞる",
    pieces: [
      [2, 2, 2, 1],
      [1, 2, 4, 1],
      [2, 1, 0, 0],
      [2, 1, 2, 3],
      [2, 1, 2, 0],
      [2, 1, 0, 3],
      [1, 1, 4, 0],
      [1, 1, 1, 1],
    ],
    pieceIndex: 7,
    events: [
      // biome-ignore lint/suspicious/noApproximativeNumericConstant: 調査が出した指の位置をそのまま写した値
      [0.707, 1.234],
      [0.623, 1.477],
      [0.21, 1.738],
      [-0.03, 1.936],
      [-0.117, 1.939],
    ],
    visited: [
      [1, 1],
      [0, 1],
      [0, 2],
    ],
  },
];

const kindByShape: Readonly<Record<string, HakoiriMusumePieceKind>> = {
  "2x2": "daughter",
  "2x1": "vertical",
  "1x2": "horizontal",
  "1x1": "small",
};

function toPiece([rows, columns, row, column]: PieceSpec): HakoiriMusumePiece {
  return { kind: kindByShape[`${rows}x${columns}`]!, cell: row * 4 + column };
}

function toPosition([row, column]: RowColumn) {
  return { row, column };
}

describe("traceHakoiriMusumeFinger", () => {
  const cases = vectors.map(({ name, pieces, pieceIndex, events, visited }) => {
    const state = { pieces: pieces.map(toPiece) };
    return {
      name,
      kind: state.pieces[pieceIndex]!.kind,
      canPlace: createHakoiriMusumePlacementCheck(state, pieceIndex),
      start: toPosition(visited[0]!),
      events: events.map(toPosition),
      expected: visited.map(toPosition),
    };
  });

  test.each(cases)(
    "調査の入力処理と同じマスを順に通ること: $name",
    ({ kind, canPlace, start, events, expected }) => {
      const passed = [start];
      let trace = startHakoiriMusumeFingerTrace(start);
      for (const event of events) {
        const traced = traceHakoiriMusumeFinger(kind, trace, event, canPlace);
        passed.push(...traced.steps);
        trace = traced.trace;
      }

      expect(passed).toEqual(expected);
    },
  );
});

describe("leanHakoiriMusumePieceTowardFinger", () => {
  const piece = { row: 1, column: 1 };
  /** 右と下にだけ置ける。 */
  const canPlace = ({ row, column }: { row: number; column: number }) =>
    (row === 1 && column === 2) || (row === 2 && column === 1);
  const cases = [
    [
      "置ける右へは指の端数ぶん寄せる",
      { row: 1.125, column: 1.25 },
      { row: 0, column: 0.25 },
    ],
    [
      "指が隣のマスへ移る手前までは、指から離れずに寄せる",
      { row: 1, column: 1.625 },
      { row: 0, column: 0.625 },
    ],
    [
      "指が隣のマスへ移る所より先へは寄せない",
      { row: 1, column: 1.9 },
      { row: 0, column: FINGER_LEAN_LIMIT },
    ],
    [
      "ふさがれた左へは寄せない",
      { row: 1, column: 0.6 },
      { row: 0, column: 0 },
    ],
    [
      "縦に大きく離れていれば縦にだけ寄せる",
      { row: 1.375, column: 1.125 },
      { row: 0.375, column: 0 },
    ],
    [
      "ふさがれた上へは寄せない",
      { row: 0.7, column: 1 },
      { row: 0, column: 0 },
    ],
  ] as const;

  test.each(cases)("%sこと", (_name, anchor, expected) => {
    const { lean } = leanHakoiriMusumePieceTowardFinger(
      piece,
      anchor,
      canPlace,
    );

    expect(lean).toEqual(expected);
  });

  describe("指が大きく離れた向きがふさがれている場合", () => {
    test("空いた向きへ寄せること", () => {
      const result = leanHakoiriMusumePieceTowardFinger(
        piece,
        { row: 0.25, column: 1.125 },
        canPlace,
      );

      expect(result).toEqual({
        lean: { row: 0, column: 0.125 },
        axis: "column",
      });
    });
  });

  describe("両方の向きに寄せられる場合", () => {
    const diagonal = { row: 1.375, column: 1.4375 };

    test("前の向きが無ければ、指が大きく離れた向きへ寄せること", () => {
      const { axis } = leanHakoiriMusumePieceTowardFinger(
        piece,
        diagonal,
        canPlace,
      );

      expect(axis).toBe("column");
    });

    test("もう一方の向きのずれが少し大きいだけなら、前の向きを保つこと", () => {
      const result = leanHakoiriMusumePieceTowardFinger(
        piece,
        diagonal,
        canPlace,
        "row",
      );

      expect(result).toEqual({ lean: { row: 0.375, column: 0 }, axis: "row" });
    });

    test("もう一方の向きのずれが替える幅を超えて大きくなれば、向きを替えること", () => {
      const { axis } = leanHakoiriMusumePieceTowardFinger(
        piece,
        { row: 1.25, column: 1.5 },
        canPlace,
        "row",
      );

      expect(axis).toBe("column");
    });
  });
});

describe("FINGER_LEAN_LIMIT", () => {
  test("指が隣のマスへ移ったとみなす所と同じで、寄せた駒が移るときに跳ばないこと", () => {
    expect(FINGER_LEAN_LIMIT).toBe(0.5 + CELL_SWITCH_INSET);
  });
});

describe("findHakoiriMusumeFlickDirection", () => {
  const down = { row: 2, column: 1, timeMs: 1000 };
  const cases = [
    [
      "速く右へ弾いて離せば右",
      [{ row: 2, column: 1.3, timeMs: 1050 }],
      "right",
    ],
    [
      "速く上へ弾いて離せば上",
      [
        { row: 1.875, column: 1, timeMs: 1020 },
        { row: 1.75, column: 1.03125, timeMs: 1040 },
      ],
      "up",
    ],
    [
      "短すぎる動きは弾いた手にしない",
      [{ row: 2, column: 1.125, timeMs: 1020 }],
      null,
    ],
    [
      "ゆっくり動かして止めてから離した手は弾いた手にしない",
      [
        { row: 2, column: 1.3, timeMs: 1400 },
        { row: 2, column: 1.3, timeMs: 1600 },
      ],
      null,
    ],
    [
      "斜めに大きくずれた動きは弾いた手にしない",
      [{ row: 2.25, column: 1.3, timeMs: 1050 }],
      null,
    ],
    [
      "弾いた向きと離す前の向きが逆なら弾いた手にしない",
      [
        { row: 2, column: 1.6, timeMs: 1050 },
        { row: 2, column: 1.3, timeMs: 1150 },
      ],
      null,
    ],
  ] as const;

  test.each(cases)("%sこと", (_name, recentPath, expected) => {
    expect(findHakoiriMusumeFlickDirection(down, recentPath)).toBe(expected);
  });
});

import {
  countHakoiriMusumeCells,
  getHakoiriMusumeCell,
  getHakoiriMusumeCellPosition,
  type HakoiriMusumeLayout,
  type HakoiriMusumePiece,
  type HakoiriMusumePieceKind,
  hakoiriMusumePieceShapes,
} from "@/games/hakoiri-musume/puzzle/board";

/**
 * 盤の作りの上の、駒の組の全局面を扱う。盤のマスは 32 以下（4×4〜5×6）で、マスの集まりを 32 bit の整数で持つ。
 *
 * 盤面は1マス1文字の文字列（`HakoiriMusumeStateKey`）で表す。駒の最初のマス（行・列の順）に駒の型の文字を置き、ほかのマスは `0`。
 * 同じ型の駒（目標でない同じ形の駒）は区別しないので、同じ並びの盤面は同じ文字列になる。
 */
export type HakoiriMusumeStateKey = string;

/** 駒の型。目標の駒は1つずつ別の型（`target` が目標の番号）、ほかの駒は形ごとに1つの型で `count` 個。 */
export type HakoiriMusumePieceType = {
  kind: HakoiriMusumePieceKind;
  target: number | null;
  count: number;
};

/** 盤の作りと駒の型。型は目標の駒を目標の番号の順に先に置き、続けてほかの駒を置く。 */
export type HakoiriMusumeSpaceSpec = {
  layout: HakoiriMusumeLayout;
  types: readonly HakoiriMusumePieceType[];
};

/** 型ごとの、駒を置ける左上の位置（置き場所）の表。 */
type TypePlacements = {
  kind: HakoiriMusumePieceKind;
  target: number | null;
  count: number;
  /** 置き場所ごとの、占めるマスの集まり。 */
  masks: Int32Array;
  /** 置き場所ごとの、駒の左上のマス。 */
  anchors: Int32Array;
  /** 置き場所ごとの、駒の最初のマス（盤面の文字を置くマス）。 */
  firstCells: Int32Array;
  /** マスごとの、そのマスを最初のマスとする置き場所。無ければ -1。 */
  placementAtFirst: Int32Array;
  /** 置き場所ごとの、上・右・下・左の隣の置き場所（無ければ -1）を4つずつ。 */
  neighbors: Int32Array;
  /** 目標の駒の、置き場所ごとの距離（空の盤で行き先の置き場所まで1マスずつ動かす最少の歩数）。目標でなければ空。 */
  distances: Int32Array;
  /** 目標の駒の、置き場所ごとの、行き先の置き場所か。 */
  goals: Uint8Array;
  /** 目標の駒の、置き場所ごとの、出口の辺に直交する向きの行き先からの離れ（遠さの判定に使う）。 */
  normals: Int32Array;
  maxDistance: number;
  maxNormal: number;
};

export type HakoiriMusumeSpace = {
  spec: HakoiriMusumeSpaceSpec;
  cellCount: number;
  wallMask: number;
  types: readonly TypePlacements[];
  targetCount: number;
  /** 目標の距離の和の最大。 */
  maxDistance: number;
  /** 左右を反転した盤面を同じ問題とみなせるか（盤の作りが左右対称で、駒の型が反転しても同じ組になる）。 */
  mirrorable: boolean;
  /** 型ごとの、左右を反転した形の型。 */
  mirrorTypes: Int32Array;
};

/** 駒の型の文字。型の番号 + 1 を文字にする。 */
const toTypeCharacter = (type: number) => String.fromCharCode(49 + type);
const EMPTY = "0";

const stepRows = [-1, 0, 1, 0] as const;
const stepColumns = [0, 1, 0, -1] as const;

function bitOf(cell: number): number {
  return 1 << cell;
}

function createTypePlacements(
  layout: HakoiriMusumeLayout,
  wallMask: number,
  type: HakoiriMusumePieceType,
): TypePlacements {
  const shape = hakoiriMusumePieceShapes[type.kind];
  const cellCount = countHakoiriMusumeCells(layout);
  const first = shape.cells[0]!;
  const masks: number[] = [];
  const anchors: number[] = [];
  const firstCells: number[] = [];
  const placementAtFirst = new Int32Array(cellCount).fill(-1);
  for (let row = 0; row + shape.rows <= layout.rows; row += 1) {
    for (
      let column = 0;
      column + shape.columns <= layout.columns;
      column += 1
    ) {
      let mask = 0;
      for (const offset of shape.cells) {
        mask |= bitOf(
          getHakoiriMusumeCell(layout, {
            row: row + offset.row,
            column: column + offset.column,
          }),
        );
      }
      if ((mask & wallMask) !== 0) {
        continue;
      }
      const firstCell = getHakoiriMusumeCell(layout, {
        row: row + first.row,
        column: column + first.column,
      });
      placementAtFirst[firstCell] = masks.length;
      masks.push(mask);
      anchors.push(getHakoiriMusumeCell(layout, { row, column }));
      firstCells.push(firstCell);
    }
  }
  const count = masks.length;
  const placementByAnchor = new Map(
    anchors.map((anchor, index) => [anchor, index]),
  );
  const neighbors = new Int32Array(count * 4).fill(-1);
  for (let index = 0; index < count; index += 1) {
    const { row, column } = getHakoiriMusumeCellPosition(
      layout,
      anchors[index]!,
    );
    for (let direction = 0; direction < 4; direction += 1) {
      const nextRow = row + stepRows[direction]!;
      const nextColumn = column + stepColumns[direction]!;
      if (
        nextRow < 0 ||
        nextColumn < 0 ||
        nextRow >= layout.rows ||
        nextColumn >= layout.columns
      ) {
        continue;
      }
      neighbors[index * 4 + direction] =
        placementByAnchor.get(
          getHakoiriMusumeCell(layout, { row: nextRow, column: nextColumn }),
        ) ?? -1;
    }
  }
  const distances = new Int32Array(type.target === null ? 0 : count);
  const goals = new Uint8Array(type.target === null ? 0 : count);
  const normals = new Int32Array(type.target === null ? 0 : count);
  let maxDistance = 0;
  let maxNormal = 0;
  if (type.target !== null) {
    const goal = layout.goals[type.target]!;
    distances.fill(-1);
    const queue: number[] = [];
    for (const placement of goal.placements) {
      const index = placementByAnchor.get(placement);
      if (index !== undefined) {
        goals[index] = 1;
        distances[index] = 0;
        queue.push(index);
      }
    }
    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head]!;
      for (let direction = 0; direction < 4; direction += 1) {
        const next = neighbors[current * 4 + direction]!;
        if (next >= 0 && distances[next] === -1) {
          distances[next] = distances[current]! + 1;
          queue.push(next);
        }
      }
    }
    const vertical = goal.exitSide === "top" || goal.exitSide === "bottom";
    const goalPositions = goal.placements.map((placement) =>
      getHakoiriMusumeCellPosition(layout, placement),
    );
    for (let index = 0; index < count; index += 1) {
      maxDistance = Math.max(maxDistance, distances[index]!);
      const position = getHakoiriMusumeCellPosition(layout, anchors[index]!);
      normals[index] = Math.min(
        ...goalPositions.map((goalPosition) =>
          vertical
            ? Math.abs(position.row - goalPosition.row)
            : Math.abs(position.column - goalPosition.column),
        ),
      );
      maxNormal = Math.max(maxNormal, normals[index]!);
    }
  }
  return {
    kind: type.kind,
    target: type.target,
    count: type.count,
    masks: Int32Array.from(masks),
    anchors: Int32Array.from(anchors),
    firstCells: Int32Array.from(firstCells),
    placementAtFirst,
    neighbors,
    distances,
    goals,
    normals,
    maxDistance,
    maxNormal,
  };
}

const mirroredKinds = {
  square: "square",
  vertical: "vertical",
  horizontal: "horizontal",
  small: "small",
  "bend-up-right": "bend-up-left",
  "bend-up-left": "bend-up-right",
  "bend-down-right": "bend-down-left",
  "bend-down-left": "bend-down-right",
} as const satisfies Record<HakoiriMusumePieceKind, HakoiriMusumePieceKind>;

export function mirrorHakoiriMusumePieceKind(
  kind: HakoiriMusumePieceKind,
): HakoiriMusumePieceKind {
  return mirroredKinds[kind];
}

/** 壁と、目標ごとの行き先の置き場所が、左右を反転しても同じなら対称。 */
export function isHakoiriMusumeLayoutMirrorSymmetric(
  layout: HakoiriMusumeLayout,
  targetKinds: readonly HakoiriMusumePieceKind[],
): boolean {
  const mirrorCell = (cell: number, width: number) => {
    const { row, column } = getHakoiriMusumeCellPosition(layout, cell);
    return getHakoiriMusumeCell(layout, {
      row,
      column: layout.columns - width - column,
    });
  };
  const sameSet = (left: readonly number[], right: readonly number[]) =>
    [...left].sort((a, b) => a - b).join() ===
    [...right].sort((a, b) => a - b).join();
  return (
    sameSet(
      layout.walls,
      layout.walls.map((wall) => mirrorCell(wall, 1)),
    ) &&
    layout.goals.every((goal, target) => {
      const kind = targetKinds[target]!;
      const width = hakoiriMusumePieceShapes[kind].columns;
      return (
        mirroredKinds[kind] === kind &&
        sameSet(
          goal.placements,
          goal.placements.map((placement) => mirrorCell(placement, width)),
        )
      );
    })
  );
}

export function createHakoiriMusumeSpace(
  spec: HakoiriMusumeSpaceSpec,
): HakoiriMusumeSpace {
  const { layout } = spec;
  const cellCount = countHakoiriMusumeCells(layout);
  if (cellCount > 32) {
    throw new RangeError("Hakoiri musume analysis supports up to 32 cells");
  }
  const wallMask = layout.walls.reduce((mask, wall) => mask | bitOf(wall), 0);
  const types = spec.types.map((type) =>
    createTypePlacements(layout, wallMask, type),
  );
  const targetCount = types.filter((type) => type.target !== null).length;
  const mirrorTypes = Int32Array.from(spec.types, (type) =>
    spec.types.findIndex(
      (candidate) =>
        candidate.kind === mirroredKinds[type.kind] &&
        candidate.target === type.target &&
        candidate.count === type.count,
    ),
  );
  const mirrorable =
    isHakoiriMusumeLayoutMirrorSymmetric(
      layout,
      spec.types.flatMap((type) => (type.target === null ? [] : [type.kind])),
    ) && mirrorTypes.every((type) => type >= 0);
  return {
    spec,
    cellCount,
    wallMask,
    types,
    targetCount,
    maxDistance: types.reduce((sum, type) => sum + type.maxDistance, 0),
    mirrorable,
    mirrorTypes,
  };
}

/** 盤面の駒（型の番号と置き場所）を、最初のマスの順に並べる。 */
export function decodeHakoiriMusumeState(
  space: HakoiriMusumeSpace,
  key: HakoiriMusumeStateKey,
): { type: number; placement: number }[] {
  const pieces: { type: number; placement: number }[] = [];
  for (let cell = 0; cell < space.cellCount; cell += 1) {
    const code = key.charCodeAt(cell) - 49;
    if (code >= 0) {
      pieces.push({
        type: code,
        placement: space.types[code]!.placementAtFirst[cell]!,
      });
    }
  }
  return pieces;
}

export function findHakoiriMusumeTargetPlacement(
  space: HakoiriMusumeSpace,
  key: HakoiriMusumeStateKey,
  target: number,
): number {
  const character = toTypeCharacter(target);
  const cell = key.indexOf(character);
  return space.types[target]!.placementAtFirst[cell]!;
}

/** 盤面の、目標の距離の和。 */
export function measureHakoiriMusumeStateDistance(
  space: HakoiriMusumeSpace,
  key: HakoiriMusumeStateKey,
): number {
  let sum = 0;
  for (let target = 0; target < space.targetCount; target += 1) {
    sum +=
      space.types[target]!.distances[
        findHakoiriMusumeTargetPlacement(space, key, target)
      ]!;
  }
  return sum;
}

export function isHakoiriMusumeGoalState(
  space: HakoiriMusumeSpace,
  key: HakoiriMusumeStateKey,
): boolean {
  for (let target = 0; target < space.targetCount; target += 1) {
    if (
      space.types[target]!.goals[
        findHakoiriMusumeTargetPlacement(space, key, target)
      ] !== 1
    ) {
      return false;
    }
  }
  return true;
}

export function encodeHakoiriMusumeState(
  space: HakoiriMusumeSpace,
  pieces: readonly { type: number; placement: number }[],
): HakoiriMusumeStateKey {
  const characters = new Array<string>(space.cellCount).fill(EMPTY);
  for (const { type, placement } of pieces) {
    characters[space.types[type]!.firstCells[placement]!] =
      toTypeCharacter(type);
  }
  return characters.join("");
}

/**
 * 1手。`key` は動かした後の盤面、`mover` は動かした目標の番号（目標でない駒は -1）、`peak` は目標の手の、1手の中で通る
 * 置き場所の距離の最大（通り方を選べるときは最も小さい通り方。目標でない駒は -1）。
 */
export type HakoiriMusumeMove = {
  key: HakoiriMusumeStateKey;
  mover: number;
  peak: number;
};

/** 同じ型の駒は区別しないので、型の文字を最初のマスへ移すだけで、ほかの同じ型の駒と入れ替えた盤面と同じ文字列になる。 */
export function listHakoiriMusumeMoves(
  space: HakoiriMusumeSpace,
  key: HakoiriMusumeStateKey,
): HakoiriMusumeMove[] {
  const pieces = decodeHakoiriMusumeState(space, key);
  let occupied = space.wallMask;
  for (const { type, placement } of pieces) {
    occupied |= space.types[type]!.masks[placement]!;
  }
  const moves: HakoiriMusumeMove[] = [];
  const characters = key.split("");
  for (const { type, placement } of pieces) {
    const placements = space.types[type]!;
    const others = occupied & ~placements.masks[placement]!;
    const reached = [placement];
    const seen = new Set(reached);
    for (let head = 0; head < reached.length; head += 1) {
      const current = reached[head]!;
      for (let direction = 0; direction < 4; direction += 1) {
        const next = placements.neighbors[current * 4 + direction]!;
        if (
          next >= 0 &&
          !seen.has(next) &&
          (placements.masks[next]! & others) === 0
        ) {
          seen.add(next);
          reached.push(next);
        }
      }
    }
    if (reached.length === 1) {
      continue;
    }
    const peaks =
      placements.target === null
        ? null
        : measureSlidePeaks(placements, reached, seen);
    const character = characters[placements.firstCells[placement]!]!;
    characters[placements.firstCells[placement]!] = EMPTY;
    for (let index = 1; index < reached.length; index += 1) {
      const next = reached[index]!;
      const firstCell = placements.firstCells[next]!;
      characters[firstCell] = character;
      moves.push({
        key: characters.join(""),
        mover: placements.target ?? -1,
        peak: peaks === null ? -1 : peaks.get(next)!,
      });
      characters[firstCell] = EMPTY;
    }
    characters[placements.firstCells[placement]!] = character;
  }
  return moves;
}

/** 動ける置き場所の中で、始めの置き場所から各置き場所へ行く道の、通る距離の最大の最小。 */
function measureSlidePeaks(
  placements: TypePlacements,
  reached: readonly number[],
  reachable: ReadonlySet<number>,
): Map<number, number> {
  const best = new Map<number, number>([
    [reached[0]!, placements.distances[reached[0]!]!],
  ]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const current of reached) {
      const value = best.get(current);
      if (value === undefined) {
        continue;
      }
      for (let direction = 0; direction < 4; direction += 1) {
        const next = placements.neighbors[current * 4 + direction]!;
        if (next < 0 || !reachable.has(next)) {
          continue;
        }
        const candidate = Math.max(value, placements.distances[next]!);
        if (candidate < (best.get(next) ?? Number.POSITIVE_INFINITY)) {
          best.set(next, candidate);
          changed = true;
        }
      }
    }
  }
  return best;
}

/** 反転できない盤の作りでは使わない。 */
export function mirrorHakoiriMusumeState(
  space: HakoiriMusumeSpace,
  key: HakoiriMusumeStateKey,
): HakoiriMusumeStateKey {
  const { layout } = space.spec;
  return encodeHakoiriMusumeState(
    space,
    decodeHakoiriMusumeState(space, key).map(({ type, placement }) => {
      const mirrorType = space.mirrorTypes[type]!;
      const placements = space.types[mirrorType]!;
      const { columns } = hakoiriMusumePieceShapes[placements.kind];
      const { row, column } = getHakoiriMusumeCellPosition(
        layout,
        space.types[type]!.anchors[placement]!,
      );
      const anchor = getHakoiriMusumeCell(layout, {
        row,
        column: layout.columns - columns - column,
      });
      return {
        type: mirrorType,
        placement: placements.anchors.indexOf(anchor),
      };
    }),
  );
}

/** 目標の駒を行き先に置いた盤面を、ほかの駒の置き方の全部について並べる（解ける盤面をたどる起点）。 */
export function enumerateHakoiriMusumeGoalStates(
  space: HakoiriMusumeSpace,
): HakoiriMusumeStateKey[] {
  const pieceCells = space.types.reduce(
    (sum, type) =>
      sum + type.count * hakoiriMusumePieceShapes[type.kind].cells.length,
    0,
  );
  const empties = space.cellCount - space.spec.layout.walls.length - pieceCells;
  const results: HakoiriMusumeStateKey[] = [];
  const characters = new Array<string>(space.cellCount).fill(EMPTY);
  const remaining = space.types.map((type) =>
    type.target === null ? type.count : 0,
  );
  const fill = (cell: number, occupied: number, emptyLeft: number) => {
    let current = cell;
    while (current < space.cellCount && (occupied & bitOf(current)) !== 0) {
      current += 1;
    }
    if (current === space.cellCount) {
      if (emptyLeft === 0 && remaining.every((count) => count === 0)) {
        results.push(characters.join(""));
      }
      return;
    }
    if (emptyLeft > 0) {
      fill(current + 1, occupied | bitOf(current), emptyLeft - 1);
    }
    space.types.forEach((type, typeIndex) => {
      if (remaining[typeIndex] === 0) {
        return;
      }
      const placement = type.placementAtFirst[current]!;
      if (placement < 0 || (type.masks[placement]! & occupied) !== 0) {
        return;
      }
      remaining[typeIndex] = remaining[typeIndex]! - 1;
      characters[current] = toTypeCharacter(typeIndex);
      fill(current + 1, occupied | type.masks[placement]!, emptyLeft);
      characters[current] = EMPTY;
      remaining[typeIndex] = remaining[typeIndex]! + 1;
    });
  };
  const placeTargets = (target: number, occupied: number) => {
    if (target === space.targetCount) {
      fill(0, occupied, empties);
      return;
    }
    const type = space.types[target]!;
    for (let placement = 0; placement < type.masks.length; placement += 1) {
      if (
        type.goals[placement] !== 1 ||
        (type.masks[placement]! & occupied) !== 0
      ) {
        continue;
      }
      characters[type.firstCells[placement]!] = toTypeCharacter(target);
      placeTargets(target + 1, occupied | type.masks[placement]!);
      characters[type.firstCells[placement]!] = EMPTY;
    }
  };
  placeTargets(0, space.wallMask);
  return results;
}

/** 目標の駒は目標の番号の順に1つずつの型、ほかの駒は形ごとの型にする。 */
export function createHakoiriMusumeProblemSpace(
  layout: HakoiriMusumeLayout,
  pieces: readonly HakoiriMusumePiece[],
): { space: HakoiriMusumeSpace; start: HakoiriMusumeStateKey } {
  const targets = layout.goals.map(
    (_, target) => pieces.find((piece) => piece.target === target)!.kind,
  );
  const otherKinds = [
    ...new Set(
      pieces.flatMap((piece) => (piece.target === null ? [piece.kind] : [])),
    ),
  ].sort();
  const types: HakoiriMusumePieceType[] = [
    ...targets.map((kind, target) => ({ kind, target, count: 1 })),
    ...otherKinds.map((kind) => ({
      kind,
      target: null,
      count: pieces.filter(
        (piece) => piece.target === null && piece.kind === kind,
      ).length,
    })),
  ];
  const space = createHakoiriMusumeSpace({ layout, types });
  const start = encodeHakoiriMusumeState(
    space,
    pieces.map((piece) => {
      const type =
        piece.target ?? targets.length + otherKinds.indexOf(piece.kind);
      return {
        type,
        placement: space.types[type]!.anchors.indexOf(piece.cell),
      };
    }),
  );
  return { space, start };
}

/** 駒は最初のマスの順に並べる。 */
export function toHakoiriMusumePieces(
  space: HakoiriMusumeSpace,
  key: HakoiriMusumeStateKey,
): HakoiriMusumePiece[] {
  return decodeHakoiriMusumeState(space, key).map(({ type, placement }) => {
    const placements = space.types[type]!;
    return {
      kind: placements.kind,
      cell: placements.anchors[placement]!,
      target: placements.target,
    };
  });
}

import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import familiesJson from "@/games/hakoiri-musume/problem/generation/families.json";
import type { HakoiriMusumePieceType } from "@/games/hakoiri-musume/problem/generation/general-space";
import type {
  HakoiriMusumeExitSide,
  HakoiriMusumeLayout,
  HakoiriMusumePieceKind,
} from "@/games/hakoiri-musume/puzzle/board";
import { hakoiriMusumePieceShapes } from "@/games/hakoiri-musume/puzzle/board";

/**
 * 族の中の駒の組ごとに全局面をたどって問題を採る。値は `families.json` に持ち、割合・補正・使うレベルは試遊の評価からコードを変えずに直す。
 * - `id`: 族の記号（例 `B45`）。画面には出さない。
 * - `palette`: ほかの駒に使える形と、1つの組に置ける数の上限。
 * - `mustIncludeOneOf`: このどれかの形を1つ以上含む組だけを使う（L字の族など）。空ならどれでもよい。
 * - `levelOffset`: 準備の長さへ足してからレベルの帯に当てる補正。
 */
export type HakoiriMusumeFamily = {
  id: string;
  label: string;
  elements: readonly string[];
  introducedAtLevel: number;
  columns: number;
  rows: number;
  walls: readonly number[];
  targets: readonly {
    kind: HakoiriMusumePieceKind;
    goalAnchors: readonly number[];
    exitSide: HakoiriMusumeExitSide;
    exitCells: readonly number[];
  }[];
  palette: readonly { kind: HakoiriMusumePieceKind; max: number }[];
  mustIncludeOneOf: readonly HakoiriMusumePieceKind[];
  emptyCells: readonly [number, number];
  maxSmallPieces: number;
  levelOffset: number;
};

/**
 * - `componentLimit`: 1つの連結成分から採る数の上限。
 * - `finalPositionLimit`: 同じ最終局面（娘が行き先に着く1手前）から採る数の上限。`null` なら縛らない。
 * - `requireFarTarget`: 1つ目の目標が出口から遠い盤面だけを採る。
 */
export type HakoiriMusumeLevelSelection = {
  optimalMoveCount: readonly [number, number];
  componentLimit: number;
  finalPositionLimit: number | null;
  requireFarTarget: boolean;
};

/** 各レベル `problemsPerLevel` 問を、族ごとの割合 `shares` で採る。 */
export type HakoiriMusumeMix = {
  problemsPerLevel: number;
  perPieceSetPerLevel: number;
  shares: Record<HakoiriMusumeDifficulty, Readonly<Record<string, number>>>;
};

type FamiliesData = {
  families: readonly HakoiriMusumeFamily[];
  mix: HakoiriMusumeMix;
  selection: Record<HakoiriMusumeDifficulty, HakoiriMusumeLevelSelection>;
};

const data = familiesJson as unknown as FamiliesData;

export const hakoiriMusumeFamilies = data.families;
export const hakoiriMusumeMix = data.mix;
export const hakoiriMusumeLevelSelections = data.selection;

export function findHakoiriMusumeFamily(id: string): HakoiriMusumeFamily {
  const family = hakoiriMusumeFamilies.find((candidate) => candidate.id === id);
  if (!family) {
    throw new RangeError(`Unknown hakoiri musume family: ${id}`);
  }
  return family;
}

export function createHakoiriMusumeFamilyLayout(
  family: HakoiriMusumeFamily,
): HakoiriMusumeLayout {
  return {
    columns: family.columns,
    rows: family.rows,
    walls: family.walls,
    goals: family.targets.map((target) => ({
      placements: target.goalAnchors,
      exitSide: target.exitSide,
      exitCells: target.exitCells,
    })),
  };
}

/** ほかの駒の形ごとの数。 */
export type HakoiriMusumePieceSet = Readonly<
  Partial<Record<HakoiriMusumePieceKind, number>>
>;

/** seed で並べ替えるのと、記録に使う。 */
export function formatHakoiriMusumePieceSet(
  pieceSet: HakoiriMusumePieceSet,
): string {
  return Object.entries(pieceSet)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([kind, count]) => `${kind}${count}`)
    .join(" ");
}

/** 目標の駒を先に、ほかの駒を形の名前の順に並べる。 */
export function createHakoiriMusumeFamilyPieceTypes(
  family: HakoiriMusumeFamily,
  pieceSet: HakoiriMusumePieceSet,
): HakoiriMusumePieceType[] {
  return [
    ...family.targets.map((target, index) => ({
      kind: target.kind,
      target: index,
      count: 1,
    })),
    ...Object.entries(pieceSet)
      .filter(([, count]) => (count ?? 0) > 0)
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .map(([kind, count]) => ({
        kind: kind as HakoiriMusumePieceKind,
        target: null,
        count: count!,
      })),
  ];
}

/** 壁は入れない。 */
export function countHakoiriMusumePieceSetEmptyCells(
  family: HakoiriMusumeFamily,
  pieceSet: HakoiriMusumePieceSet,
): number {
  const cellsOf = (kind: HakoiriMusumePieceKind) =>
    hakoiriMusumePieceShapes[kind].cells.length;
  return (
    family.columns * family.rows -
    family.walls.length -
    family.targets.reduce((sum, target) => sum + cellsOf(target.kind), 0) -
    Object.entries(pieceSet).reduce(
      (sum, [kind, count]) =>
        sum + (count ?? 0) * cellsOf(kind as HakoiriMusumePieceKind),
      0,
    )
  );
}

export function listHakoiriMusumeFamilyPieceSets(
  family: HakoiriMusumeFamily,
): HakoiriMusumePieceSet[] {
  const cellsOf = (kind: HakoiriMusumePieceKind) =>
    hakoiriMusumePieceShapes[kind].cells.length;
  const free =
    family.columns * family.rows -
    family.walls.length -
    family.targets.reduce((sum, target) => sum + cellsOf(target.kind), 0);
  const results: HakoiriMusumePieceSet[] = [];
  const counts: Partial<Record<HakoiriMusumePieceKind, number>> = {};
  const visit = (index: number, used: number) => {
    if (index === family.palette.length) {
      const empties = free - used;
      const small = counts.small ?? 0;
      if (
        empties >= family.emptyCells[0] &&
        empties <= family.emptyCells[1] &&
        small <= family.maxSmallPieces &&
        (family.mustIncludeOneOf.length === 0 ||
          family.mustIncludeOneOf.some((kind) => (counts[kind] ?? 0) > 0))
      ) {
        results.push({ ...counts });
      }
      return;
    }
    const { kind, max } = family.palette[index]!;
    for (
      let count = 0;
      count <= max && used + count * cellsOf(kind) <= free;
      count += 1
    ) {
      counts[kind] = count;
      visit(index + 1, used + count * cellsOf(kind));
    }
    delete counts[kind];
  };
  visit(0, 0);
  return results;
}

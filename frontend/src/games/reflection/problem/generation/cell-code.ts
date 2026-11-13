import {
  type ReflectionCell,
  reflectionPieces,
} from "@/games/reflection/puzzle/board";

export type ReflectionCellCode = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 同型判定の正規化キーはマスの番号の並びの辞書順で最小のものを取るので、順序を変えると正規化キーも変わる。 */
export const reflectionCellsByCode = [
  null,
  ...reflectionPieces,
] as const satisfies readonly ReflectionCell[];

export const reflectionCellCodes = reflectionCellsByCode.map(
  (_, code) => code as ReflectionCellCode,
);

export function toReflectionCellCode(cell: ReflectionCell): ReflectionCellCode {
  return (
    cell === null ? 0 : reflectionPieces.indexOf(cell) + 1
  ) as ReflectionCellCode;
}

export function fromReflectionCellCode(
  code: ReflectionCellCode,
): ReflectionCell {
  return reflectionCellsByCode[code];
}

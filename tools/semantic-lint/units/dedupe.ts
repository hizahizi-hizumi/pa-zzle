type Ranged = {
  path: string;
  startLine: number;
  endLine: number;
};

/**
 * 入れ子の単位が同じ違反を重ねて指摘したとき、最も内側の指摘だけを残す。
 * 外側の単位の指摘が内側の指摘を包含する場合は外側を捨て、同じ範囲は1つにまとめる。
 * 入力順を優先度として扱うため、呼び出し側で確率の高い順に並べておく。
 */
export function dedupeNestedFindings<T extends Ranged>(items: readonly T[]): T[] {
  const unique: T[] = [];

  for (const item of items) {
    if (!unique.some((kept) => sameRange(kept, item))) {
      unique.push(item);
    }
  }

  return unique.filter(
    (item) =>
      !unique.some(
        (other) =>
          other !== item &&
          other.path === item.path &&
          item.startLine <= other.startLine &&
          item.endLine >= other.endLine,
      ),
  );
}

function sameRange(left: Ranged, right: Ranged): boolean {
  return (
    left.path === right.path &&
    left.startLine === right.startLine &&
    left.endLine === right.endLine
  );
}

/**
 * 並び順が浅い順で、解法器は局面ごとに最も浅い手筋から試す。SPEC-008 の手筋とは次のように対応する。
 * - `full-house`: 残り1マス
 * - `hidden-single-block`: ブロックのシングル
 * - `hidden-single-line`: 行・列のシングル
 * - `naked-single`: マスのシングル
 * - `locked-candidates`: ブロックと行・列の重なり
 * - `naked-pair` / `naked-triple`: 数字の組
 * - `hidden-pair` / `hidden-triple`: 場所の組
 * - `x-wing` / `swordfish`: 行・列の組み合わせ
 * - `xy-wing` / `xyz-wing`: 3マスの候補のつながり
 *
 * 手筋の推論は `generation/human-solver.ts` が持ち、ここは難易度の特徴量や生成条件でも使う名前だけを持つ。
 */
export const nanpureTechniques = [
  "full-house",
  "hidden-single-block",
  "hidden-single-line",
  "naked-single",
  "locked-candidates",
  "naked-pair",
  "hidden-pair",
  "naked-triple",
  "hidden-triple",
  "x-wing",
  "swordfish",
  "xy-wing",
  "xyz-wing",
] as const;

export type NanpureTechnique = (typeof nanpureTechniques)[number];

const placementTechniques: ReadonlySet<NanpureTechnique> = new Set([
  "full-house",
  "hidden-single-block",
  "hidden-single-line",
  "naked-single",
]);

export function isNanpurePlacementTechnique(
  technique: NanpureTechnique,
): boolean {
  return placementTechniques.has(technique);
}

export function compareNanpureTechniqueDepth(
  left: NanpureTechnique,
  right: NanpureTechnique,
): number {
  return nanpureTechniques.indexOf(left) - nanpureTechniques.indexOf(right);
}

export function listNanpureTechniquesUpTo(
  limit: NanpureTechnique,
): readonly NanpureTechnique[] {
  return nanpureTechniques.slice(0, nanpureTechniques.indexOf(limit) + 1);
}

/**
 * 人間向けの手筋。並び順が浅い順で、解法器は局面ごとに最も浅い手筋から試す。
 *
 * 数字を置く手筋（シングル）:
 * - `full-house`（残り1マス）: 行・列・ブロックに空きマスが1つだけ残り、入る数字が1つに決まる。
 * - `hidden-single-block`（ブロックのシングル）: ブロックの中で、ある数字を置けるマスが1つしかない。
 * - `hidden-single-line`（行・列のシングル）: 行・列の中で、ある数字を置けるマスが1つしかない。
 * - `naked-single`（マスのシングル）: あるマスに入り得る数字が1つしかない。
 *
 * 候補を消す手筋:
 * - `locked-candidates`（ブロックと行・列の重なり）: ブロックの中である数字の候補が1本の行・列に並ぶ（または行・列の中で1つのブロックに収まる）とき、その行・列（ブロック）の残りから候補を消す。
 * - `naked-pair` / `naked-triple`（数字の組）: 1つの単位で2（3）マスの候補が合わせて2（3）種類なら、同じ単位の他のマスからその数字を消す。
 * - `hidden-pair` / `hidden-triple`（場所の組）: 1つの単位で2（3）種類の数字の置き場所が合わせて2（3）マスなら、そのマスから他の候補を消す。
 * - `x-wing` / `swordfish`（2本・3本の行・列の組み合わせ）: ある数字の候補が2（3）本の行で同じ2（3）本の列に収まるなら、その列の他の行から消す（行と列を入れ替えても同じ）。
 * - `xy-wing` / `xyz-wing`（3マスの候補のつながり）: 候補2（3）つのマスを軸に、候補2つの2マスが共通の数字を挟むとき、3マスの読みが示す数字を共通に見えるマスから消す。
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

/** 数字を置く手筋か。そうでなければ候補を消す手筋。 */
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

/** 上限の手筋までの浅い手筋の並び。問題生成で使ってよい手筋を決めるのに使う。 */
export function listNanpureTechniquesUpTo(
  limit: NanpureTechnique,
): readonly NanpureTechnique[] {
  return nanpureTechniques.slice(0, nanpureTechniques.indexOf(limit) + 1);
}

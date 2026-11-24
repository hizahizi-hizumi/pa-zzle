type FrontAligner = () => Promise<void>;

let aligner: FrontAligner | null = null;

/**
 * 結果のピースを立体で動かしている間、正面を向いた平面の姿へ戻す手続きを預ける。戻り値は、預けるのをやめる関数。
 */
export function registerZukanResultPieceFrontAligner(
  align: FrontAligner,
): () => void {
  aligner = align;
  return function unregister() {
    if (aligner === align) aligner = null;
  };
}

/**
 * 結果のピースを、正面を向いた平面の姿へ戻す。画面の行き来でピースを平面の写しにして運ぶ前に、姿が跳ばないよう揃える。
 * 立体で動かしていなければ、揃える必要が無いので `null`。
 */
export function alignZukanResultPieceToFront(): Promise<void> | null {
  return aligner?.() ?? null;
}

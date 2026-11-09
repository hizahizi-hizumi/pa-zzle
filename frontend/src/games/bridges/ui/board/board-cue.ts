/**
 * 辺に一時的に重ねる合図。チュートリアルで、次に押す所と手への応えを、説明文に頼らず盤面の上で示すのに使う。
 * - `mark`: 次に押す辺の印。`recallId` は印の無い所が押されるたびに変え、変わると印の線を短く濃くして戻す。押されていなければ `null`。
 * - `acknowledgement`: 手順の辺を手順の本数まで架けたことに、その瞬間だけ控えめに応える。`id` が変わるとやり直す。
 */
export type BridgesBoardCue =
  | { kind: "mark"; edge: number; recallId: number | null }
  | { kind: "acknowledgement"; edge: number; id: number };

/**
 * チュートリアルで手を引いている間、画面全体の覆いから抜いて元の明るさで見せる島と辺。
 * - `islands`: 島の丸。
 * - `edges`: 2島の間の、橋を架ける所。
 */
export type BridgesBoardSpotlight = {
  islands: readonly number[];
  edges: readonly number[];
};

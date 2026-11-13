/**
 * - `mark`: 次に押す辺の印。`recallId` は印の無い所が押されるたびに変え、変わると印の線を短く濃くして戻す。押されていなければ `null`。
 * - `acknowledgement`: 手順の辺を手順の本数まで架けたことに、その瞬間だけ控えめに応える。`id` が変わるとやり直す。
 */
export type BridgesBoardCue =
  | { kind: "mark"; edge: number; recallId: number | null }
  | { kind: "acknowledgement"; edge: number; id: number };

export type BridgesBoardSpotlight = {
  islands: readonly number[];
  edges: readonly number[];
};

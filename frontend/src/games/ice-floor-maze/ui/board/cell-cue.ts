/**
 * チュートリアルで、駒を止めるマスに付ける印。
 * - `recallId`: 印の無い向きへ滑らせようとされるたびに変え、変わると印の線を短く濃くして戻す。押されていなければ `null`。
 */
export type IceFloorMazeCellCue = {
  cellIndex: number;
  recallId: number | null;
};

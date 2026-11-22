/** 注ぐ動きの中で栓を差すときの時刻（注ぐ動きの始まりからの ms）。 */
export type TestTubeSealTiming = {
  /** 注いだ液が届ききって、1種類で満ちる所。 */
  filledMs: number;
  /** 栓を差し込み始める所。 */
  stopperStartMs: number;
};

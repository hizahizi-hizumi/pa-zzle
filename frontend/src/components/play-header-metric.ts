/** プレイ中に見出しへ並べる計測値。回数と経過時間を、全ゲームで同じ書式で出す。 */
export type PlayHeaderMetric =
  | { type: "count"; label: string; count: number }
  | { type: "elapsed-time"; elapsedMs: number };

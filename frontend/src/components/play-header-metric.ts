/** プレイ中に見出しへ並べる計測値。回数と経過時間を、全ゲームで同じ書式で出す。 */
export type PlayHeaderMetric =
  | {
      type: "count";
      label: string;
      count: number;
      /** 値がこの桁数に満たなくても取る幅。省くと2桁分を取る。 */
      reservedDigits?: number;
    }
  | { type: "elapsed-time"; elapsedMs: number };

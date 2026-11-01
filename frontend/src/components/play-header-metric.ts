/**
 * プレイ中に見出しへ並べる計測値。回数と経過時間を、全ゲームで同じ書式で出す。
 * `problem-fact` は、プレイで変わらない問題そのものの条件（例: 詰将棋の「5手詰」）。数え上げる回数と混同しないよう、
 * 「ラベル 数」ではなくゲームが渡した文言のまま出す。
 */
export type PlayHeaderMetric =
  | {
      type: "count";
      label: string;
      count: number;
      /** 値がこの桁数に満たなくても取る幅。省くと2桁分を取る。 */
      reservedDigits?: number;
    }
  | { type: "problem-fact"; text: string }
  | { type: "elapsed-time"; elapsedMs: number };

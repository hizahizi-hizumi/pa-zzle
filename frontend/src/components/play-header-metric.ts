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

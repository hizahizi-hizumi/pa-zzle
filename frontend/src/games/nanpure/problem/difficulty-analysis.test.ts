import type { NanpureBoard, NanpureCell } from "../puzzle/board";
import { analyzeNanpureDifficulty } from "./difficulty-analysis";

function boardFromString(value: string): NanpureBoard {
  return [...value].map<NanpureCell>((cell) =>
    cell === "." || cell === "0" ? null : (Number(cell) as NanpureCell),
  );
}

describe("analyzeNanpureDifficulty", () => {
  const supportedProblemClues = boardFromString(
    "......812.143..59...5216...4..567.8.8....346.1.7.4..2.7.....95.5.1.8.64.6....4.7.",
  );
  const unsupportedProblemClues = boardFromString(
    "100007090030020008009600500005300900010080002600004000300000010040000007007000300",
  );

  test("対応手筋で解き切れる問題の特徴を解析すること", () => {
    const result = analyzeNanpureDifficulty(supportedProblemClues);

    expect(result.status).toBe("supported");
    expect(result.features.dependency.observedStepCount).toBeGreaterThan(0);
  });

  test("対応手筋で解き切れない問題を未対応として返すこと", () => {
    const result = analyzeNanpureDifficulty(unsupportedProblemClues);

    expect(result.status).toBe("unsupported");
  });
});

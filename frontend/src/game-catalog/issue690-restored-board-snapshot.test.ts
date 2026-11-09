import { createIssue690SampleRecord } from "@/game-catalog/issue690-compare-sample";
import { createIssue690RestoredBoardSnapshot } from "@/game-catalog/issue690-restored-board-snapshot";
import { isIssue690BoardSnapshot } from "@/games/issue690-board-snapshot";
import { isNanpureSolved } from "@/games/nanpure/puzzle/rules";
import { isWaterSortCleared } from "@/games/water-sort/puzzle/state";

describe("createIssue690RestoredBoardSnapshot", () => {
  const waterRecord = createIssue690SampleRecord("water-sort");
  const nanpureRecord = createIssue690SampleRecord("nanpure");

  test("実際の問題の色数からクリア済みの配置例を作り、最後の一手を捏造しないこと", () => {
    if (!waterRecord) throw new Error("water-sort sample missing");
    const snapshot = createIssue690RestoredBoardSnapshot(waterRecord);

    expect(snapshot?.gameId).toBe("water-sort");
    expect(snapshot && isIssue690BoardSnapshot(snapshot)).toBe(true);
    if (snapshot?.gameId !== "water-sort") return;
    expect(snapshot.reconstructed).toBe(true);
    expect(snapshot.lastMove).toBeNull();
    expect(isWaterSortCleared(snapshot.bottles)).toBe(true);
  });

  test("当該問題の完成解を復元し、存在しない最終入力位置を示さないこと", () => {
    if (!nanpureRecord) throw new Error("nanpure sample missing");
    const snapshot = createIssue690RestoredBoardSnapshot(nanpureRecord);

    expect(snapshot?.gameId).toBe("nanpure");
    expect(snapshot && isIssue690BoardSnapshot(snapshot)).toBe(true);
    if (snapshot?.gameId !== "nanpure") return;
    expect(snapshot.reconstructed).toBe(true);
    expect(snapshot.lastCellIndex).toBeNull();
    expect(
      isNanpureSolved(snapshot.board as Parameters<typeof isNanpureSolved>[0]),
    ).toBe(true);
  });
});

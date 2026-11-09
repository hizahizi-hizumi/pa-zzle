import { findGameCatalogEntry } from "@/game-catalog/game-catalog";
import {
  createIssue690SampleOutcome,
  createIssue690SampleRecord,
} from "@/game-catalog/issue690-compare-sample";

describe("#690の実際の結果画面用サンプル", () => {
  test.each(["water-sort", "nanpure"])(
    "%sの結果画面と同じ記録復元を通る",
    (gameId) => {
      const record = createIssue690SampleRecord(gameId);
      const game = findGameCatalogEntry(gameId);
      expect(record).not.toBeNull();
      expect(game).toBeDefined();
      if (!record || !game) return;
      expect(record.gameId).toBe(gameId);
      expect(game.hasRecordResult(record)).toBe(true);
      const outcome = createIssue690SampleOutcome(
        record,
        game.playRecordDisplay,
      );
      expect(outcome.status).toBe("updated");
      if (outcome.status !== "updated") return;
      expect(outcome.updates).toHaveLength(1);
      const [update] = outcome.updates;
      if (!update) throw new Error("比較用の更新内容がありません");
      expect(update.metricId).toBe("time-delta-ms");
      expect(update.previousValue).toBeGreaterThan(update.currentValue);
    },
  );
  test("存在しないゲームではサンプルを作らない", () => {
    expect(createIssue690SampleRecord("unknown")).toBeNull();
  });
});

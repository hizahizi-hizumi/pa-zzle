import { toZukanGameSource } from "@/app/game-integration/game-catalog-entry";
import { nanpureCatalogEntry } from "@/app/game-integration/nanpure/nanpure-catalog-entry";
import {
  listRandomProblemCandidates,
  selectAnyRandomProblemId,
  selectRandomProblemId,
} from "@/features/random-play/random-problem-selection";
import {
  _private,
  randomProblemSettings,
} from "@/features/random-play/random-problem-settings";
import {
  abandonPlayAttempt,
  startPlayAttempt,
} from "@/features/records/play-attempt-storage";
import { writePlayRecords } from "@/features/records/storage";
import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import { selectNanpureProblemById } from "@/games/nanpure/problem-selection";

const game = {
  ...nanpureCatalogEntry,
  listPoolProblemIds(difficulty: "1" | "2" | "3" | "4" | "5") {
    return nanpureCatalogEntry.listPoolProblemIds(difficulty).slice(0, 6);
  },
};
const source = toZukanGameSource(game);
const ids = game.listPoolProblemIds("1");
const solved = [0, 1, 2, 3].map((index) => {
  const selected = selectNanpureProblemById("1", ids[index] ?? "");
  if (!selected) throw new Error("テスト用問題が見つかりません");
  return createNanpurePlayRecord({
    difficulty: "1",
    problemIdentity: selected.identity,
    startedAt: index * 200_000 + 1,
    completedAt: index * 200_000 + 10_000,
    result: {
      elapsedMs: 900_000,
      mistakeCount: [0, 1, 3, 5][index] ?? 0,
      undoCount: 0,
      restartCount: 0,
    },
  });
});
const attempted = selectNanpureProblemById("1", ids[4] ?? "");
if (!attempted) throw new Error("テスト用問題が見つかりません");

beforeEach(() => {
  writePlayRecords(solved);
  startPlayAttempt({
    gameId: game.id,
    startedAt: 1_000_000,
    start: { difficulty: "1", problemIdentity: attempted.identity },
    abandonment: null,
  });
  abandonPlayAttempt(
    { gameId: game.id, startedAt: 1_000_000 },
    { abandonedAt: 1_010_000, progress: { elapsedMs: 10_000 } },
  );
});

afterEach(() => {
  window.localStorage.clear();
  _private.reset();
});

describe("listRandomProblemCandidates", () => {
  test("図鑑と同じ6分類から選んだ状態の問題だけを返すこと", () => {
    randomProblemSettings.setGlobal(["great", "attempted", "untouched"]);
    const candidates = listRandomProblemCandidates(source, "1");

    expect(candidates).toEqual([ids[1], ids[4], ids[5]]);
  });

  test("最高スコア100点の問題をperfectとして扱い、別の状態へ出題しないこと", () => {
    randomProblemSettings.setGlobal(["clear", "good", "great"]);
    const candidates = listRandomProblemCandidates(source, "1");

    expect(candidates).toEqual([ids[1], ids[2], ids[3]]);
  });

  test("ゲーム別設定が共通設定に優先すること", () => {
    randomProblemSettings.setGlobal(["perfect"]);
    randomProblemSettings.setGame("nanpure", ["untouched"]);
    const candidates = listRandomProblemCandidates(source, "1");

    expect(candidates).toEqual([ids[5]]);
  });

  test("直前の問題を確実に除外し、候補がなくなっても拡張しないこと", () => {
    randomProblemSettings.setGlobal(["untouched"]);
    const candidates = listRandomProblemCandidates(source, "1", ids[5]);

    expect(candidates).toEqual([]);
  });

  test("すべて選択では全問から直前の問題を除外すること", () => {
    const candidates = listRandomProblemCandidates(source, "1", ids[1]);

    expect(candidates).toEqual(ids.filter((id) => id !== ids[1]));
  });
});

describe("selectRandomProblemId", () => {
  test("条件の対象がなくても明示した一回だけ全状態から選び設定を保つこと", () => {
    randomProblemSettings.setGlobal(["untouched"]);
    const selected = selectAnyRandomProblemId(source, "1", ids[5]);
    expect(ids.slice(0, 5)).toContain(selected);
    expect(randomProblemSettings.getEffective(game.id)).toEqual(["untouched"]);
  });

  test("選んだ候補から抽選し、候補がなければnullを返すこと", () => {
    randomProblemSettings.setGlobal(["untouched"]);
    const selected = selectRandomProblemId(source, "1");
    const missing = selectRandomProblemId(source, "1", ids[5]);

    expect(selected).toBe(ids[5]);
    expect(missing).toBeNull();
  });
});

import { difficultyLevels } from "@/games/difficulty";
import {
  findParkingJamPoolEntryByProblemId,
  findParkingJamPoolProblemFeatures,
  listParkingJamPoolEntries,
  toParkingJamPoolIdentity,
} from "@/games/parking-jam/problem/problem-pool";
import { createProblemId } from "@/games/problem-id";

describe("findParkingJamPoolEntryByProblemId", () => {
  const poolEntries = difficultyLevels.flatMap(({ id: difficulty }) =>
    listParkingJamPoolEntries(difficulty).map((entry) => ({
      difficulty,
      entry,
      problemId: createProblemId(toParkingJamPoolIdentity(entry)),
    })),
  );

  test("問題集の全項目の問題IDが互いに異なること", () => {
    const distinctProblemIds = new Set(
      poolEntries.map(({ problemId }) => problemId),
    );

    expect(distinctProblemIds.size).toBe(poolEntries.length);
  });

  test("問題集の全項目をその難易度と問題IDで引けること", () => {
    const unresolvedEntries = poolEntries.filter(
      ({ difficulty, entry, problemId }) =>
        findParkingJamPoolEntryByProblemId(difficulty, problemId) !== entry,
    );

    expect(unresolvedEntries).toEqual([]);
  });
});

describe("findParkingJamPoolProblemFeatures", () => {
  const [entry] = listParkingJamPoolEntries("3");
  if (!entry) {
    throw new Error("No level 3 parking jam pool entry");
  }
  const identity = toParkingJamPoolIdentity(entry);
  const problemId = createProblemId(identity);

  test("問題集の1問の特徴を、生成条件の駐車場の縦横と車・植え込みの数で返すこと", () => {
    const features = findParkingJamPoolProblemFeatures("3", problemId);

    expect(features).toEqual({
      rows: identity.conditions.height,
      columns: identity.conditions.width,
      vehicleCount: identity.conditions.vehicleCount,
      fixedAreaCount: identity.conditions.fixedAreaCount,
    });
  });

  test("問題集に無い ID と、別の難易度の ID には null を返すこと", () => {
    const unknown = findParkingJamPoolProblemFeatures("3", "unknown");
    const otherDifficulty = findParkingJamPoolProblemFeatures("1", problemId);

    expect(unknown).toBeNull();
    expect(otherDifficulty).toBeNull();
  });
});

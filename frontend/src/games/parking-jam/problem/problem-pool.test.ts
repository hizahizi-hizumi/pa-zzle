import { parkingJamDifficulties } from "@/games/parking-jam/difficulty";
import {
  findParkingJamPoolEntryByProblemId,
  listParkingJamPoolEntries,
  toParkingJamPoolIdentity,
} from "@/games/parking-jam/problem/problem-pool";
import { createProblemId } from "@/games/problem-id";

describe("findParkingJamPoolEntryByProblemId", () => {
  const poolEntries = parkingJamDifficulties.flatMap(({ id: difficulty }) =>
    listParkingJamPoolEntries(difficulty).map((entry) => ({
      difficulty,
      entry,
      problemId: createProblemId(toParkingJamPoolIdentity(entry)),
    })),
  );
  const firstLevel2Entry = poolEntries.find(
    ({ difficulty }) => difficulty === "2",
  );
  const unknownProblemId = "0000000000";

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

  test("別の難易度の問題IDでは引けないこと", () => {
    const found = findParkingJamPoolEntryByProblemId(
      "1",
      firstLevel2Entry?.problemId ?? "",
    );

    expect(firstLevel2Entry).toBeDefined();
    expect(found).toBeNull();
  });

  test("問題集に無い問題IDでは引けないこと", () => {
    const found = findParkingJamPoolEntryByProblemId("1", unknownProblemId);

    expect(found).toBeNull();
  });
});

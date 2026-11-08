import { describe, expect, test } from "vitest";
import {
  getContinuousStudyContinuation,
  getContinuousStudyPlayUrl,
} from "@/experiments/continuous-study";
import { selectContinuousStudySequence } from "@/experiments/curated-study-selection";

const games = ["nanpure", "parking-jam"] as const;
const difficulties = ["3", "4", "5"] as const;
const methods = ["random", "diverse"] as const;

const conditions = games.flatMap((gameId) =>
  difficulties.flatMap((difficulty) =>
    methods.map((method) => ({ gameId, difficulty, method })),
  ),
);

describe("連続プレイの比較", () => {
  test.each(conditions)(
    "$gameId Lv$difficulty $method は同じ難易度の異なる10問を供給する",
    ({ gameId, difficulty, method }) => {
      const first = selectContinuousStudySequence(
        gameId,
        difficulty,
        method,
        0,
      );
      const again = selectContinuousStudySequence(
        gameId,
        difficulty,
        method,
        0,
      );
      expect(first).toEqual(again);
      expect(first).toHaveLength(10);
      expect(
        first?.every((candidate) => candidate.difficulty === difficulty),
      ).toBe(true);
      expect(new Set(first?.map((candidate) => candidate.problemId)).size).toBe(
        10,
      );
    },
  );

  test.each(games)(
    "%s は次問の並びを変える選択方法が実際に異なる",
    (gameId) => {
      const random = selectContinuousStudySequence(gameId, "3", "random", 1);
      const diverse = selectContinuousStudySequence(gameId, "3", "diverse", 1);
      expect(random).toHaveLength(10);
      expect(diverse).toHaveLength(10);
      expect(random).not.toEqual(diverse);
    },
  );

  test("再生した問題のIDが一致したときだけ次の指定問題に進む", () => {
    const sequence = selectContinuousStudySequence(
      "nanpure",
      "3",
      "diverse",
      0,
    );
    const firstId = sequence?.[0]?.problemId ?? "";
    const secondId = sequence?.[1]?.problemId ?? "";
    const url = getContinuousStudyPlayUrl("nanpure", "3", "diverse", 0, 0);
    expect(url).toContain(`problem=${firstId}`);
    const continuation = getContinuousStudyContinuation(
      "continuous.nanpure.3.diverse.0.0",
      "nanpure",
      "3",
      firstId,
    );
    expect(continuation).toEqual({
      destination: getContinuousStudyPlayUrl("nanpure", "3", "diverse", 0, 1),
      label: "次の問題",
    });
    expect(continuation?.destination).toContain(`problem=${secondId}`);
    expect(
      getContinuousStudyContinuation(
        "continuous.nanpure.3.diverse.0.0",
        "nanpure",
        "3",
        "wrong",
      ),
    ).toBeNull();
    expect(
      getContinuousStudyContinuation(
        "continuous.nanpure.3.diverse.0.0",
        "parking-jam",
        "3",
        firstId,
      ),
    ).toBeNull();
    expect(
      getContinuousStudyContinuation(
        "continuous.nanpure.3.diverse.0.0",
        "nanpure",
        "4",
        firstId,
      ),
    ).toBeNull();
    expect(
      getContinuousStudyContinuation(
        "continuous.nanpure.3.diverse.0.99",
        "nanpure",
        "3",
        firstId,
      ),
    ).toBeNull();
  });

  test("参加者の試遊条件は結果画面から次問・終了画面まで維持する", () => {
    const sequence = selectContinuousStudySequence("nanpure", "3", "random", 0);
    const first = getContinuousStudyPlayUrl(
      "nanpure",
      "3",
      "random",
      0,
      0,
      true,
    );
    expect(first).toContain("study=continuous.nanpure.3.random.0.0.p");
    const next = getContinuousStudyContinuation(
      "continuous.nanpure.3.random.0.0.p",
      "nanpure",
      "3",
      sequence?.[0]?.problemId ?? "",
    );
    expect(next?.destination).toContain(
      "study=continuous.nanpure.3.random.0.1.p",
    );
    const last = getContinuousStudyContinuation(
      "continuous.nanpure.3.random.0.9.p",
      "nanpure",
      "3",
      sequence?.[9]?.problemId ?? "",
    );
    expect(last?.destination).toContain("participant=1");
  });

  test("10問目は試遊終了画面に戻り、範囲外の条件は拒否する", () => {
    const final = selectContinuousStudySequence(
      "parking-jam",
      "4",
      "random",
      5,
    )?.[9];
    expect(
      getContinuousStudyContinuation(
        "continuous.parking-jam.4.random.5.9",
        "parking-jam",
        "4",
        final?.problemId ?? "",
      ),
    ).toEqual({
      destination:
        "/studies/continuous?game=parking-jam&difficulty=4&method=random&episode=5&finished=1",
      label: "比較画面へ戻る",
    });
    expect(
      getContinuousStudyPlayUrl("nanpure", "3", "random", -1, 0),
    ).toBeNull();
    expect(
      getContinuousStudyPlayUrl("nanpure", "3", "random", 0, 10),
    ).toBeNull();
    expect(
      getContinuousStudyContinuation(
        "continuous.nanpure.3.random.100.0",
        "nanpure",
        "3",
        "unknown",
      ),
    ).toBeNull();
  });
});

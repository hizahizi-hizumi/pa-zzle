import {
  baysRuleExample,
  boardOrderExample,
  boardRuleExample,
  createShuttleParkingExampleBoard,
  exitOperationExample,
  exitRuleExamples,
  judgeShuttleParkingExample,
  type ShuttleParkingHowToPlayExample,
  tapShuttleParkingExampleCar,
} from "@/games/shuttle-parking/ui/ShuttleParkingHowToPlayDialog/example-board";

function tapHint(example: ShuttleParkingHowToPlayExample) {
  return tapShuttleParkingExampleCar(
    createShuttleParkingExampleBoard(example),
    example.hintCarId,
    1,
    0,
  );
}

describe("judgeShuttleParkingExample", () => {
  test.each([
    ["前の空いた車", exitRuleExamples[0], true, null],
    ["前を塞がれた車", exitRuleExamples[1], false, "path-blocked"],
    ["待機枠が埋まった盤面の車", baysRuleExample, false, "bays-full"],
    ["乗る例の車", boardRuleExample, true, null],
    ["操作の例の車", exitOperationExample, true, null],
  ] as const)(
    "押す前の%sは、本番の判定どおりに出られるかとわけを返すこと",
    (_, example, exitable, reason) => {
      const verdict = judgeShuttleParkingExample(
        createShuttleParkingExampleBoard(example),
        example.hintCarId,
      );

      expect(verdict).toMatchObject({ exitable, reason, tried: false });
    },
  );
});

describe("tapShuttleParkingExampleCar", () => {
  test("前を塞がれた車を押すと、盤面を変えずに揺らす知らせだけを返すこと", () => {
    const tapped = tapHint(exitRuleExamples[1]);

    expect(tapped.state).toBe(tapped.initial);
    expect(tapped.operation).toMatchObject({
      type: "blocked",
      reason: "path-blocked",
    });
  });

  test("塞がれた例で前の車を出すと、手がかりの車は出られる判定に変わること", () => {
    const tapped = tapShuttleParkingExampleCar(
      createShuttleParkingExampleBoard(exitRuleExamples[1]),
      1,
      1,
      0,
    );

    const verdict = judgeShuttleParkingExample(
      tapped,
      exitRuleExamples[1].hintCarId,
    );

    expect(verdict).toMatchObject({ exitable: true, tried: false });
  });

  test("乗る例の車を押すと、4人が乗り2台が出発すること", () => {
    const tapped = tapHint(boardRuleExample);

    const verdict = judgeShuttleParkingExample(
      tapped,
      boardRuleExample.hintCarId,
    );

    expect(verdict).toMatchObject({
      tried: true,
      boardedCount: 4,
      departedCount: 2,
    });
  });

  test("同じ色の車が2台待つ例で青を押すと、7人が乗り3台が出発すること", () => {
    const tapped = tapHint(boardOrderExample);

    const verdict = judgeShuttleParkingExample(
      tapped,
      boardOrderExample.hintCarId,
    );

    expect(verdict).toMatchObject({
      tried: true,
      boardedCount: 7,
      departedCount: 3,
    });
  });

  test("横の車は開いた右の辺から出ること", () => {
    const tapped = tapHint(boardRuleExample);

    expect(tapped.operation).toMatchObject({ type: "exited", side: "right" });
  });
});

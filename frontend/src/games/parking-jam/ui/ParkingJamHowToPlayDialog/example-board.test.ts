import type { ParkingJamMove } from "@/games/parking-jam/puzzle/board";
import {
  createParkingJamExampleBoard,
  describeParkingJamExampleCaption,
  findParkingJamExampleHint,
  isParkingJamExampleChanged,
  listParkingJamExampleMoveMarks,
  moveParkingJamExampleVehicle,
  type ParkingJamExampleBoard,
  selectParkingJamExampleVehicle,
} from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/example-board";
import {
  carRuleExample,
  roadRuleExample,
  straightRuleExample,
  tapOperationExample,
} from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-boards";

function moveAll(
  example: ParkingJamExampleBoard,
  moves: readonly ParkingJamMove[],
): ParkingJamExampleBoard {
  return moves.reduce(moveParkingJamExampleVehicle, example);
}

/** ほかの車のルールの例で、2マスの車を、塞いでいる3マスの車へ向けて出す手。 */
const blockedMove: ParkingJamMove = { vehicleId: "a", direction: "right" };
/** 道路のルールの例で、隣の車線にしか道路が無い右へ出す手。 */
const blockedRoadMove: ParkingJamMove = { vehicleId: "a", direction: "right" };
/** ほかの車のルールの例で、じゃまな3マスの車を上へ出す手。 */
const blockerExit: ParkingJamMove = { vehicleId: "b", direction: "up" };

const carInitial = createParkingJamExampleBoard(carRuleExample);
const carBlockerSelected = selectParkingJamExampleVehicle(carInitial, "b");
const carBlockerExited = moveParkingJamExampleVehicle(carInitial, blockerExit);
const carBlockedSelected = moveParkingJamExampleVehicle(
  selectParkingJamExampleVehicle(carInitial, "a"),
  blockedMove,
);
const carBlocked = moveParkingJamExampleVehicle(carInitial, blockedMove);

describe("listParkingJamExampleMoveMarks", () => {
  test("始まりの盤面では、残っている車の両端に本番の判定で出られるかの印を付け、例が印を付けないとした手には付けないこと", () => {
    const marks = listParkingJamExampleMoveMarks(carInitial, carRuleExample);

    expect(marks).toEqual([
      { vehicleId: "b", direction: "up", allowed: true },
      { vehicleId: "b", direction: "down", allowed: true },
      { vehicleId: "a", direction: "right", allowed: false },
    ]);
  });

  test("じゃまな車が出たら、その車の印を除き、塞がれていた車の右を出られる印に替えること", () => {
    const marks = listParkingJamExampleMoveMarks(
      carBlockerExited,
      carRuleExample,
    );

    expect(marks).toEqual([
      { vehicleId: "a", direction: "right", allowed: true },
    ]);
  });

  test("車を押して矢印を出しても、その車の印を残すこと", () => {
    const marked = listParkingJamExampleMoveMarks(
      carBlockerSelected,
      carRuleExample,
    ).map(({ vehicleId, direction }) => `${vehicleId}:${direction}`);

    expect(marked).toEqual(["b:up", "b:down", "a:right"]);
  });
});

describe("moveParkingJamExampleVehicle", () => {
  const selectedBlocker = selectParkingJamExampleVehicle(carInitial, "b");
  const selectedBlocked = selectParkingJamExampleVehicle(carInitial, "a");

  test("出られない向きでは盤面を変えず、矢印を出したままにし、当たった物を残すこと", () => {
    const next = moveParkingJamExampleVehicle(selectedBlocked, blockedMove);

    expect(next.session.puzzleState).toEqual(carInitial.session.puzzleState);
    expect(next.selectedVehicleId).toBe("a");
    expect(next.lastAttempt).toEqual({
      outcome: "blocked",
      move: blockedMove,
      blockers: [{ kind: "vehicle", vehicleId: "b" }],
    });
  });

  test("出られる向きでは車を出して矢印を消すこと", () => {
    const next = moveParkingJamExampleVehicle(selectedBlocker, blockerExit);

    expect(next.session.puzzleState.remainingVehicleIds).toEqual(["a"]);
    expect(next.selectedVehicleId).toBeNull();
    expect(next.lastAttempt).toEqual({ outcome: "exited", move: blockerExit });
  });
});

describe("selectParkingJamExampleVehicle", () => {
  test("同じ車をもう一度押すと、矢印を消すこと", () => {
    const next = selectParkingJamExampleVehicle(carBlockerSelected, "b");

    expect(next.selectedVehicleId).toBeNull();
  });

  test("当たった後に車を押すと、試した手を消すこと", () => {
    const next = selectParkingJamExampleVehicle(carBlocked, "b");

    expect(next.lastAttempt).toBeNull();
  });

  test("出た車は押しても矢印を出さないこと", () => {
    const next = selectParkingJamExampleVehicle(carBlockerExited, "b");

    expect(next).toBe(carBlockerExited);
  });
});

describe("findParkingJamExampleHint", () => {
  const carDone = moveAll(carInitial, carRuleExample.moves);
  const carReselected = selectParkingJamExampleVehicle(carBlockedSelected, "a");
  const straightUp = moveParkingJamExampleVehicle(
    createParkingJamExampleBoard(straightRuleExample),
    { vehicleId: "a", direction: "up" },
  );
  const roadInitial = createParkingJamExampleBoard(roadRuleExample);
  const roadBlocked = moveParkingJamExampleVehicle(
    roadInitial,
    blockedRoadMove,
  );
  const roadReselected = selectParkingJamExampleVehicle(roadBlocked, "a");
  const tapSelected = selectParkingJamExampleVehicle(
    createParkingJamExampleBoard(tapOperationExample),
    "a",
  );

  test("始まりの盤面では、例が見せる最初の手の車に付けること", () => {
    const hint = findParkingJamExampleHint(carInitial, carRuleExample);

    expect(hint).toEqual({ ...blockerExit, target: "vehicle" });
  });

  test("最初の手を打った後は、次の手の車に移すこと", () => {
    const hint = findParkingJamExampleHint(carBlockerExited, carRuleExample);

    expect(hint).toEqual({ ...blockedMove, target: "vehicle" });
  });

  test("見せる手を打ち終えたら、付けないこと", () => {
    const hint = findParkingJamExampleHint(carDone, carRuleExample);

    expect(hint).toBeNull();
  });

  test("当たった後は付けず、車を押し直すとまた付けること", () => {
    const hints = [carBlockedSelected, carReselected].map((example) =>
      findParkingJamExampleHint(example, carRuleExample),
    );

    expect(hints).toEqual([null, { ...blockerExit, target: "vehicle" }]);
  });

  test("次の手の車が矢印を出していれば、出す向きの矢印に付けること", () => {
    const hint = findParkingJamExampleHint(tapSelected, tapOperationExample);

    expect(hint).toEqual({ vehicleId: "a", direction: "up", target: "arrow" });
  });

  test("出られない手を見せる例では、始まりの盤面でその手に付け、当てた後は付けず、車を押し直すとまた付けること", () => {
    const hints = [roadInitial, roadBlocked, roadReselected].map((example) =>
      findParkingJamExampleHint(example, roadRuleExample),
    );

    expect(hints).toEqual([
      { ...blockedRoadMove, target: "vehicle" },
      null,
      { ...blockedRoadMove, target: "arrow" },
    ]);
  });

  test("見せる手と違う向きへ出して最後の車が出たら、付けないこと", () => {
    const hint = findParkingJamExampleHint(straightUp, straightRuleExample);

    expect(hint).toBeNull();
  });
});

describe("describeParkingJamExampleCaption", () => {
  const roadInitial = createParkingJamExampleBoard(roadRuleExample);
  const roadBlocked = moveParkingJamExampleVehicle(
    roadInitial,
    blockedRoadMove,
  );
  const roadExited = moveParkingJamExampleVehicle(roadInitial, {
    vehicleId: "a",
    direction: "left",
  });
  const roadSelected = selectParkingJamExampleVehicle(roadInitial, "a");

  test("試す前は、盤面に付いている印の記号の凡例を言うこと", () => {
    const caption = describeParkingJamExampleCaption(
      roadInitial,
      roadRuleExample,
    );

    expect(caption).toEqual({
      kind: "legend",
      allowed: true,
      disallowed: true,
    });
  });

  test("当たったら、試した向きと当たった物の種類を言うこと", () => {
    const caption = describeParkingJamExampleCaption(
      roadBlocked,
      roadRuleExample,
    );

    expect(caption).toEqual({
      kind: "blocked",
      direction: "right",
      blockers: ["wall"],
    });
  });

  test("最後の車が出て印が無くなったら、出た向きを言うこと", () => {
    const caption = describeParkingJamExampleCaption(
      roadExited,
      roadRuleExample,
    );

    expect(caption).toEqual({ kind: "exited", direction: "left" });
  });

  test("車が出ても印が残っていれば、残る印の凡例を言うこと", () => {
    const caption = describeParkingJamExampleCaption(
      carBlockerExited,
      carRuleExample,
    );

    expect(caption).toEqual({
      kind: "legend",
      allowed: true,
      disallowed: false,
    });
  });

  test("車を押して矢印を出しても、印の凡例を言い続けること", () => {
    const caption = describeParkingJamExampleCaption(
      roadSelected,
      roadRuleExample,
    );

    expect(caption).toEqual({
      kind: "legend",
      allowed: true,
      disallowed: true,
    });
  });
});

describe("isParkingJamExampleChanged", () => {
  test("矢印を出しただけでは変わったとみなさず、車が出たら変わったとみなすこと", () => {
    const changed = [carBlockerSelected, carBlockerExited].map((example) =>
      isParkingJamExampleChanged(example, carRuleExample),
    );

    expect(changed).toEqual([false, true]);
  });
});

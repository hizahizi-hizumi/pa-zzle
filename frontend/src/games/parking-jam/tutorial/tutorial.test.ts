import { assertParkingJamProblem } from "@/games/parking-jam/problem/problem";
import {
  createParkingJamInitialState,
  isParkingJamCleared,
  type ParkingJamDirection,
  type ParkingJamState,
  type ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import {
  applyParkingJamMove,
  listParkingJamLegalMoves,
} from "@/games/parking-jam/puzzle/rules";
import {
  findParkingJamTutorialBlocker,
  findParkingJamTutorialContact,
  findParkingJamTutorialHintVehicle,
  getParkingJamTutorialStepVehicle,
  PARKING_JAM_TUTORIAL_BOARD,
  type ParkingJamTutorialBlocker,
  type ParkingJamTutorialBoardState,
  type ParkingJamTutorialRuleId,
  parkingJamTutorial,
} from "@/games/parking-jam/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

type Progress = TutorialProgress<
  ParkingJamTutorialRuleId,
  ParkingJamTutorialBoardState
>;

const board = PARKING_JAM_TUTORIAL_BOARD;
const { steps } = parkingJamTutorial;

/** 出られない手で当たったものと、それを示すルール。 */
const blockerRules = {
  road: "road",
  planter: "planter",
  car: "car",
} as const satisfies Record<
  ParkingJamTutorialBlocker,
  ParkingJamTutorialRuleId
>;

const started = finishTutorialIntro(startTutorial(parkingJamTutorial));

function getVehicle(vehicleId: ParkingJamVehicleId) {
  const vehicle = board.vehicles.find(({ id }) => id === vehicleId);
  if (!vehicle) {
    throw new Error(`車 ${vehicleId} がない`);
  }
  return vehicle;
}

/** 車の向きに沿う2つの向き。 */
function listDirections(vehicleId: ParkingJamVehicleId): ParkingJamDirection[] {
  return getVehicle(vehicleId).orientation === "horizontal"
    ? ["left", "right"]
    : ["up", "down"];
}

function canExit(
  puzzle: ParkingJamState,
  vehicleId: ParkingJamVehicleId,
): boolean {
  return listParkingJamLegalMoves(board, puzzle).some(
    (move) => move.vehicleId === vehicleId,
  );
}

function perform(
  progress: Progress,
  vehicleId: ParkingJamVehicleId,
  direction: ParkingJamDirection,
): Progress {
  return performTutorialAction(parkingJamTutorial, progress, {
    vehicleId,
    direction,
  });
}

/** 手順の車を出られる向きへ出して、`count` 個目の手順まで終える。 */
function playSteps(count: number): Progress {
  return steps.slice(0, count).reduce((progress, step) => {
    const direction = listDirections(step.vehicleId).find(
      (candidate) =>
        findParkingJamTutorialBlocker(progress.boardState.puzzle, {
          vehicleId: step.vehicleId,
          direction: candidate,
        }) === null,
    );
    if (!direction) {
      throw new Error(`手順の車 ${step.vehicleId} を動かす向きがない`);
    }
    return perform(progress, step.vehicleId, direction);
  }, started);
}

/** 今の盤面から、どの順に出してもたどり着く盤面。出庫は車を減らすだけなので、残る車の組で表す。 */
function listReachableStates(from: ParkingJamState): ParkingJamState[] {
  const reached = new Map([[from.remainingVehicleIds.join(), from]]);
  const pending = [from];
  for (let current = pending.pop(); current; current = pending.pop()) {
    for (const move of listParkingJamLegalMoves(board, current)) {
      const next = applyParkingJamMove(board, current, move);
      const key = next?.remainingVehicleIds.join();
      if (next && key !== undefined && !reached.has(key)) {
        reached.set(key, next);
        pending.push(next);
      }
    }
  }
  return [...reached.values()];
}

/** 今出せる車を同時に出していったときの段数。出し切れなければ `null`。 */
function countRemovalLayers(from: ParkingJamState): number | null {
  let current = from;
  let layers = 0;
  while (!isParkingJamCleared(current)) {
    const exitable = new Set(
      listParkingJamLegalMoves(board, current).map(
        ({ vehicleId }) => vehicleId,
      ),
    );
    if (exitable.size === 0) {
      return null;
    }
    current = {
      remainingVehicleIds: current.remainingVehicleIds.filter(
        (vehicleId) => !exitable.has(vehicleId),
      ),
    };
    layers += 1;
  }
  return layers;
}

function getMessage(progress: Progress) {
  return getTutorialMessage(parkingJamTutorial, progress, {
    entry: "selection",
    violationSettled: true,
  });
}

describe("盤面", () => {
  test("本番と同じ形の問題として受け付けられること", () => {
    expect(() => assertParkingJamProblem({ board })).not.toThrow();
  });

  test("ゴールの盤面が、すべての車を出した空の駐車場であること", () => {
    const goal = parkingJamTutorial.goal().puzzle;

    expect(isParkingJamCleared(goal)).toBe(true);
  });

  test("始めの盤面から、どの順に出しても行き詰まらずにすべての車を出せること", () => {
    const stuckStates = listReachableStates(
      createParkingJamInitialState(board),
    ).filter((state) => countRemovalLayers(state) === null);

    expect(stuckStates).toEqual([]);
  });
});

describe("手順", () => {
  const stepCases = steps.map((step, index) => ({
    step,
    index,
    before: playSteps(index),
  }));

  test.each(stepCases)(
    "$index 番目の手順の車が、どちらへ動かしても、出られるか、それまでに示したルールで当たること",
    ({ step, before }) => {
      const earned = getTutorialSituation(
        parkingJamTutorial,
        before,
      ).earnedRuleIds;
      const blockerRulesOfStep = listDirections(step.vehicleId).flatMap(
        (direction) => {
          const blocker = findParkingJamTutorialBlocker(
            before.boardState.puzzle,
            { vehicleId: step.vehicleId, direction },
          );
          return blocker === null ? [] : [blockerRules[blocker]];
        },
      );

      expect(earned).toEqual(
        expect.arrayContaining([...new Set(blockerRulesOfStep)]),
      );
    },
  );

  test("最初の手順が、どちらへ動かしても出られる車で、前か後ろへまっすぐ出ることを示すこと", () => {
    const [first] = steps;
    const exitable = listDirections(first?.vehicleId ?? "").map(
      (direction) =>
        findParkingJamTutorialBlocker(started.boardState.puzzle, {
          vehicleId: first?.vehicleId ?? "",
          direction,
        }) === null,
    );

    expect(first?.introducedRuleId).toBe("straight");
    expect(exitable).toEqual([true, true]);
  });

  const blockerStepCases = [
    ["road", "道路がない"],
    ["planter", "植え込みがある"],
  ] as const;

  test.each(blockerStepCases)(
    "%s を示す手順の車が、片方は%sので当たり、もう片方へ出られること",
    (ruleId) => {
      const index = steps.findIndex(
        ({ introducedRuleId }) => introducedRuleId === ruleId,
      );
      const step = steps[index];
      const puzzle = playSteps(index).boardState.puzzle;
      const blockers = listDirections(step?.vehicleId ?? "").map((direction) =>
        findParkingJamTutorialBlocker(puzzle, {
          vehicleId: step?.vehicleId ?? "",
          direction,
        }),
      );

      expect(blockers).toEqual(expect.arrayContaining([null, ruleId]));
    },
  );

  test("car を示す手順が、ほかの車を塞いでいる車を出させ、塞がれていた車をその向きへ出られるようにすること", () => {
    const index = steps.findIndex(
      ({ introducedRuleId }) => introducedRuleId === "car",
    );
    const step = steps[index];
    const waitingMove = step?.waitingMove;
    const before = playSteps(index).boardState.puzzle;
    const after = playSteps(index + 1).boardState.puzzle;
    const contact =
      waitingMove && findParkingJamTutorialContact(before, waitingMove);

    expect(contact?.blocker).toEqual({
      kind: "vehicle",
      vehicleId: step?.vehicleId,
    });
    expect(canExit(before, step?.vehicleId ?? "")).toBe(true);
    expect(
      waitingMove && findParkingJamTutorialContact(after, waitingMove),
    ).toBeNull();
  });

  test("手順の間、出られない手でしか進まない手順が無いこと", () => {
    const exitableSteps = steps.map((step, index) =>
      canExit(playSteps(index).boardState.puzzle, step.vehicleId),
    );

    expect(exitableSteps).toEqual(steps.map(() => true));
  });

  test("手順を終えると、すべてのルールを示して手を離すこと", () => {
    const released = playSteps(steps.length);

    expect(released.stepIndex).toBe(steps.length);
    expect(released.earnedRuleIds).toEqual([
      "straight",
      "road",
      "planter",
      "car",
    ]);
    expect(getMessage(released)).toBe(parkingJamTutorial.freePlay);
  });

  test("手を離した後の残りを、どの順に出しても行き詰まらず、先に出す車を読む必要があること", () => {
    const released = playSteps(steps.length).boardState.puzzle;
    const stuckStates = listReachableStates(released).filter(
      (state) => countRemovalLayers(state) === null,
    );

    expect(released.remainingVehicleIds.length).toBe(3);
    expect(stuckStates).toEqual([]);
    expect(countRemovalLayers(released)).toBe(2);
  });
});

describe("performTutorialAction", () => {
  const [first, second] = steps;
  const firstVehicleId = first?.vehicleId ?? "";
  const secondVehicleId = second?.vehicleId ?? "";

  test("手を引いている間は、印の無い車を動かしても受け付けないこと", () => {
    const ignored = perform(started, secondVehicleId, "right");

    expect(ignored).toBe(started);
  });

  test("印の車を出すと、盤面から出して次の手順へ進むこと", () => {
    const exited = perform(started, firstVehicleId, "down");

    expect(exited.boardState.puzzle.remainingVehicleIds).not.toContain(
      firstVehicleId,
    );
    expect(exited.boardState.lastMove).toEqual({
      vehicleId: firstVehicleId,
      direction: "down",
      type: "exited",
    });
    expect(exited.stepIndex).toBe(1);
  });

  test("まっすぐ先に道路がない向きへ出そうとすると、盤面を変えずにそのわけを言い、手順に留まること", () => {
    const before = playSteps(1);
    const blocked = perform(before, secondVehicleId, "left");

    expect(blocked.violated).toBe(true);
    expect(blocked.stepIndex).toBe(1);
    expect(blocked.boardState.puzzle).toEqual(before.boardState.puzzle);
    expect(getMessage(blocked).headline).toBe(
      "まっすぐ先に道路がないと\n出られません",
    );
    expect(blocked.boardState.lastMove).toMatchObject({
      type: "blocked",
      blocker: "road",
      contact: { blocker: { kind: "wall" } },
    });
  });

  test("塞がれた車を示している手順で、その車を動かしても受け付けないこと", () => {
    const index = steps.findIndex(({ waitingMove }) => waitingMove !== null);
    const before = playSteps(index);
    const waitingMove = steps[index]?.waitingMove;
    const ignored = perform(
      before,
      waitingMove?.vehicleId ?? "",
      waitingMove?.direction ?? "left",
    );

    expect(ignored).toBe(before);
  });

  describe("手を離した後の場合", () => {
    const released = playSteps(steps.length);

    const blockedCases = [
      [
        "まっすぐ先に道路がない向き",
        "d",
        "left",
        "まっすぐ先に道路がないと\n出られません",
      ],
      ["ほかの車がある向き", "d", "right", "ほかの車があると\n通れません"],
      [
        "道路がない車線でも、手前のほかの車",
        "f",
        "left",
        "ほかの車があると\n通れません",
      ],
    ] as const;

    test.each(blockedCases)(
      "%sへ出そうとすると、そのわけを言うこと",
      (_, vehicleId, direction, headline) => {
        const blocked = perform(released, vehicleId, direction);

        expect(blocked.violated).toBe(true);
        expect(getMessage(blocked).headline).toBe(headline);
      },
    );

    test("出られない向きの一言が、そのルールを示した手順の一言と同じ文であること", () => {
      const violationHeadlines = (["road", "planter", "car"] as const).map(
        (blocker) =>
          parkingJamTutorial.describeViolation(
            getTutorialSituation(parkingJamTutorial, released),
            {
              ...released.boardState,
              lastMove: {
                vehicleId: "d",
                direction: "left",
                type: "blocked",
                blocker,
                contact: { blocker: { kind: "wall" }, freeCellCount: 0 },
              },
            },
          ).headline,
      );
      const stepHeadlines = (["road", "planter", "car"] as const).map(
        (ruleId) =>
          steps.find(({ introducedRuleId }) => introducedRuleId === ruleId)
            ?.message.headline,
      );

      expect(violationHeadlines).toEqual(stepHeadlines);
    });

    test("次に車を出すと、違反の一言を下げて残りを出す一言に戻すこと", () => {
      const blocked = perform(released, "d", "left");
      const exited = perform(blocked, "f", "right");

      expect(exited.violated).toBe(false);
      expect(getMessage(exited)).toBe(parkingJamTutorial.freePlay);
    });
  });
});

describe("getParkingJamTutorialStepVehicle", () => {
  test("手を引いている間は手順の車を、手を離した後は何も返さないこと", () => {
    const vehicles = [started, playSteps(steps.length)].map((progress) =>
      getParkingJamTutorialStepVehicle(
        getTutorialSituation(parkingJamTutorial, progress),
      ),
    );

    expect(vehicles).toEqual([steps[0]?.vehicleId, null]);
  });
});

describe("findParkingJamTutorialHintVehicle", () => {
  test("示された車を出せる向きへ出し続けると、すべての車を出し終えること", () => {
    let progress = playSteps(steps.length);
    for (let turn = 0; turn < 10 && progress.phase === "playing"; turn += 1) {
      const vehicleId = findParkingJamTutorialHintVehicle(progress.boardState);
      const direction = listDirections(vehicleId ?? "").find(
        (candidate) =>
          findParkingJamTutorialBlocker(progress.boardState.puzzle, {
            vehicleId: vehicleId ?? "",
            direction: candidate,
          }) === null,
      );
      progress = perform(progress, vehicleId ?? "", direction ?? "left");
    }

    expect(progress.phase).toBe("solved");
  });

  test("出し終えた盤面では何も示さないこと", () => {
    const hint = findParkingJamTutorialHintVehicle(parkingJamTutorial.goal());

    expect(hint).toBeNull();
  });
});

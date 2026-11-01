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
  listParkingJamMoveBlockers,
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

/** 指定した見出しの手順。 */
function findStepIndex(ruleId: ParkingJamTutorialRuleId): number {
  return steps.findIndex(({ introducedRuleId }) => introducedRuleId === ruleId);
}

/** 出庫を続けてたどり着く盤面すべてで、車の向きに沿う手のうち出られない手。 */
function listBlockedMovesOnReachableStates(): {
  puzzle: ParkingJamState;
  move: { vehicleId: ParkingJamVehicleId; direction: ParkingJamDirection };
}[] {
  return listReachableStates(createParkingJamInitialState(board)).flatMap(
    (puzzle) =>
      puzzle.remainingVehicleIds.flatMap((vehicleId) =>
        listDirections(vehicleId)
          .map((direction) => ({ vehicleId, direction }))
          .filter(
            (move) =>
              listParkingJamMoveBlockers(board, puzzle, move).length > 0,
          )
          .map((move) => ({ puzzle, move })),
      ),
  );
}

function getMessage(progress: Progress) {
  return getTutorialMessage(parkingJamTutorial, progress, {
    entry: "selection",
    violationSettled: true,
  });
}

describe("盤面", () => {
  const problem = { board };
  const start = createParkingJamInitialState(board);
  const goal = parkingJamTutorial.goal().puzzle;

  test("本番と同じ形の問題として受け付けられること", () => {
    const act = () => assertParkingJamProblem(problem);

    expect(act).not.toThrow();
  });

  test("ゴールの盤面が、すべての車を出した空の駐車場であること", () => {
    const cleared = isParkingJamCleared(goal);

    expect(cleared).toBe(true);
  });

  test("始めの盤面から、どの順に出しても行き詰まらずにすべての車を出せること", () => {
    const stuckStates = listReachableStates(start).filter(
      (state) => countRemovalLayers(state) === null,
    );

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
    "$index 番目の手順の車を、印のとおりに出せること",
    ({ step, before }) => {
      const exitable = canExit(before.boardState.puzzle, step.vehicleId);

      expect(exitable).toBe(true);
    },
  );

  test.each(stepCases)(
    "$index 番目の手順の車が出られない向きのわけが、それまでに示したルールであること",
    ({ step, before }) => {
      const blockerRulesOfStep = listDirections(step.vehicleId).flatMap(
        (direction) => {
          const blocker = findParkingJamTutorialBlocker(
            before.boardState.puzzle,
            { vehicleId: step.vehicleId, direction },
          );
          return blocker === null ? [] : [blockerRules[blocker]];
        },
      );

      expect(before.earnedRuleIds).toEqual(
        expect.arrayContaining(blockerRulesOfStep),
      );
    },
  );

  describe("最初の手順", () => {
    const [first] = steps;
    const vehicleId = first?.vehicleId ?? "";

    test("どちらへ動かしても出られる車で、前か後ろへまっすぐ出ることを示すこと", () => {
      const exitable = listDirections(vehicleId).map(
        (direction) =>
          findParkingJamTutorialBlocker(started.boardState.puzzle, {
            vehicleId,
            direction,
          }) === null,
      );

      expect(first?.introducedRuleId).toBe("straight");
      expect(exitable).toEqual([true, true]);
    });
  });

  const blockerStepCases = (["road", "planter"] as const).map((ruleId) => {
    const index = findStepIndex(ruleId);
    return {
      ruleId,
      vehicleId: steps[index]?.vehicleId ?? "",
      puzzle: playSteps(index).boardState.puzzle,
    };
  });

  test.each(blockerStepCases)(
    "$ruleId を示す手順の車が、片方はそのルールで出られず、もう片方へ出られること",
    ({ ruleId, vehicleId, puzzle }) => {
      const blockers = listDirections(vehicleId).map((direction) =>
        findParkingJamTutorialBlocker(puzzle, { vehicleId, direction }),
      );

      expect(blockers).toEqual(expect.arrayContaining([null, ruleId]));
    },
  );

  describe("car を示す手順", () => {
    const index = findStepIndex("car");
    const step = steps[index];
    const waitingMove = step?.waitingMove ?? {
      vehicleId: "",
      direction: "left",
    };
    const before = playSteps(index).boardState.puzzle;
    const after = playSteps(index + 1).boardState.puzzle;

    test("印の車が、示している塞がれた車の進む先にいること", () => {
      const contact = findParkingJamTutorialContact(before, waitingMove);

      expect(contact?.blocker).toEqual({
        kind: "vehicle",
        vehicleId: step?.vehicleId,
      });
    });

    test("印の車を出すと、塞がれていた車がその向きへ出られるようになること", () => {
      const contact = findParkingJamTutorialContact(after, waitingMove);

      expect(contact).toBeNull();
    });
  });

  describe("手順を終えた場合", () => {
    const released = playSteps(steps.length);

    test("すべてのルールを示して手を離すこと", () => {
      const message = getMessage(released);

      expect(released.stepIndex).toBe(steps.length);
      expect(released.earnedRuleIds).toEqual([
        "straight",
        "road",
        "planter",
        "car",
      ]);
      expect(message).toBe(parkingJamTutorial.freePlay);
    });

    test("残りを、どの順に出しても行き詰まらず、先に出す車を読む必要があること", () => {
      const puzzle = released.boardState.puzzle;
      const stuckStates = listReachableStates(puzzle).filter(
        (state) => countRemovalLayers(state) === null,
      );
      const layers = countRemovalLayers(puzzle);

      expect(puzzle.remainingVehicleIds).toHaveLength(3);
      expect(stuckStates).toEqual([]);
      expect(layers).toBe(2);
    });
  });
});

describe("findParkingJamTutorialContact", () => {
  const blockedMoves = listBlockedMovesOnReachableStates();

  test("出庫を続けてたどり着くどの盤面でも、出られない手のわけが本番の判定と同じ優先で選ばれること", () => {
    const mismatches = blockedMoves.filter(({ puzzle, move }) => {
      const contact = findParkingJamTutorialContact(puzzle, move);
      const blockers = listParkingJamMoveBlockers(board, puzzle, move);
      const wall = blockers.some(({ kind }) => kind === "wall");
      return (
        contact === null ||
        (contact.blocker.kind === "wall") !== wall ||
        !blockers.some(
          (blocker) =>
            JSON.stringify(blocker) === JSON.stringify(contact.blocker),
        )
      );
    });

    expect(blockedMoves.length).toBeGreaterThan(0);
    expect(mismatches).toEqual([]);
  });
});

describe("performTutorialAction", () => {
  const [first, second] = steps;
  const firstVehicleId = first?.vehicleId ?? "";
  const secondVehicleId = second?.vehicleId ?? "";
  const afterFirstStep = playSteps(1);
  const waitingStepIndex = steps.findIndex(
    ({ waitingMove }) => waitingMove !== null,
  );
  const beforeWaitingStep = playSteps(waitingStepIndex);
  const waitingMove = steps[waitingStepIndex]?.waitingMove ?? {
    vehicleId: "",
    direction: "left",
  };

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

  test("進む先に道路がない向きへ出そうとすると、盤面を変えずにそのわけを言い、手順に留まること", () => {
    const blocked = perform(afterFirstStep, secondVehicleId, "left");
    const message = getMessage(blocked);

    expect(blocked.violated).toBe(true);
    expect(blocked.stepIndex).toBe(1);
    expect(blocked.boardState.puzzle).toEqual(afterFirstStep.boardState.puzzle);
    expect(message.headline).toBe("進む先に道路がないと\n出られません");
    expect(blocked.boardState.lastMove).toMatchObject({
      type: "blocked",
      blocker: "road",
      contact: { blocker: { kind: "wall" } },
    });
  });

  test("塞がれた車を示している手順で、その車を動かしても受け付けないこと", () => {
    const ignored = perform(
      beforeWaitingStep,
      waitingMove.vehicleId,
      waitingMove.direction,
    );

    expect(ignored).toBe(beforeWaitingStep);
  });

  describe("手を離した後の場合", () => {
    const released = playSteps(steps.length);
    const blockedByD = perform(released, "d", "left");

    const blockedCases = [
      [
        "進む先に道路がない向き",
        "d",
        "left",
        "進む先に道路がないと\n出られません",
      ],
      ["ほかの車がある向き", "d", "right", "ほかの車があると\n通れません"],
      [
        "途中にほかの車があっても道路につながっていない向き",
        "f",
        "left",
        "進む先に道路がないと\n出られません",
      ],
    ] as const;

    test.each(blockedCases)(
      "%sへ出そうとすると、そのわけを言うこと",
      (_, vehicleId, direction, headline) => {
        const blocked = perform(released, vehicleId, direction);
        const message = getMessage(blocked);

        expect(blocked.violated).toBe(true);
        expect(message.headline).toBe(headline);
      },
    );

    const violationCases = (["road", "planter", "car"] as const).map(
      (blocker) => ({
        blocker,
        boardState: {
          ...released.boardState,
          lastMove: {
            vehicleId: "d",
            direction: "left",
            type: "blocked",
            blocker,
            contact: { blocker: { kind: "wall" }, freeCellCount: 0 },
          },
        } satisfies ParkingJamTutorialBoardState,
        stepHeadline: steps[findStepIndex(blocker)]?.message.headline,
      }),
    );

    test.each(violationCases)(
      "$blocker のわけの一言が、そのルールを示した手順の見出しと同じ文であること",
      ({ boardState, stepHeadline }) => {
        const message = parkingJamTutorial.describeViolation(
          getTutorialSituation(parkingJamTutorial, released),
          boardState,
        );

        expect(message.headline).toBe(stepHeadline);
      },
    );

    test("次に車を出すと、違反の一言を下げて残りを出す一言に戻すこと", () => {
      const exited = perform(blockedByD, "f", "right");
      const message = getMessage(exited);

      expect(exited.violated).toBe(false);
      expect(message).toBe(parkingJamTutorial.freePlay);
    });
  });
});

describe("getParkingJamTutorialStepVehicle", () => {
  const situations = [started, playSteps(steps.length)].map((progress) =>
    getTutorialSituation(parkingJamTutorial, progress),
  );

  test("手を引いている間は手順の車を、手を離した後は何も返さないこと", () => {
    const vehicles = situations.map(getParkingJamTutorialStepVehicle);

    expect(vehicles).toEqual([steps[0]?.vehicleId, null]);
  });
});

describe("findParkingJamTutorialHintVehicle", () => {
  const released = playSteps(steps.length);
  const goal = parkingJamTutorial.goal();

  test("示された車を出せる向きへ出し続けると、すべての車を出し終えること", () => {
    let progress = released;
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
    const hint = findParkingJamTutorialHintVehicle(goal);

    expect(hint).toBeNull();
  });
});

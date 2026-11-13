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
  describeParkingJamTutorialHint,
  findParkingJamTutorialBlocker,
  findParkingJamTutorialContact,
  findParkingJamTutorialDecider,
  findParkingJamTutorialHint,
  getParkingJamTutorialProgressRatio,
  getParkingJamTutorialStepMove,
  PARKING_JAM_TUTORIAL_BOARD,
  PARKING_JAM_TUTORIAL_PROGRESS_STEP_COUNT,
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

function playSteps(count: number): Progress {
  return steps
    .slice(0, count)
    .reduce(
      (progress, step) => perform(progress, step.vehicleId, step.exitDirection),
      started,
    );
}

function listReachableStates(from: ParkingJamState): ParkingJamState[] {
  // 出庫は車を減らすだけなので、盤面を残る車の組で表す。
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

function findStepIndex(ruleId: ParkingJamTutorialRuleId): number {
  return steps.findIndex(({ introducedRuleId }) => introducedRuleId === ruleId);
}

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
    entry: "home",
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

  const blockerStepCases = (["road", "planter", "car"] as const).map(
    (ruleId) => {
      const index = findStepIndex(ruleId);
      return {
        ruleId,
        vehicleId: steps[index]?.vehicleId ?? "",
        puzzle: playSteps(index).boardState.puzzle,
      };
    },
  );

  test.each(blockerStepCases)(
    "$ruleId を示す手順の車が、片方はそのルールで出られず、もう片方へ出られること",
    ({ ruleId, vehicleId, puzzle }) => {
      const blockers = listDirections(vehicleId).map((direction) =>
        findParkingJamTutorialBlocker(puzzle, { vehicleId, direction }),
      );

      expect(blockers).toEqual(expect.arrayContaining([null, ruleId]));
    },
  );

  test("書き出したルールのそれぞれを、いずれかの手順で示すこと", () => {
    const introduced = steps.map(({ introducedRuleId }) => introducedRuleId);

    expect(introduced).toEqual(parkingJamTutorial.rules.map(({ id }) => id));
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

      expect(puzzle.remainingVehicleIds).toHaveLength(4);
      expect(stuckStates).toEqual([]);
      expect(layers).toBe(2);
    });

    test("残りに、片方は道路がなく、もう片方は今出せる車1台だけに塞がれた車があり、塞いでいる車を先に出す読みがもう一度要ること", () => {
      const puzzle = released.boardState.puzzle;
      const waitingVehicleIds = puzzle.remainingVehicleIds.filter(
        (vehicleId) => {
          const blockers = listDirections(vehicleId).map((direction) =>
            listParkingJamMoveBlockers(board, puzzle, {
              vehicleId,
              direction,
            }),
          );
          const wallSide = blockers.some(
            (list) => list.length === 1 && list[0]?.kind === "wall",
          );
          const blockerId = blockers
            .flatMap((list) =>
              list.length === 1 && list[0]?.kind === "vehicle"
                ? [list[0].vehicleId]
                : [],
            )
            .at(0);
          return (
            wallSide && blockerId !== undefined && canExit(puzzle, blockerId)
          );
        },
      );

      expect(waitingVehicleIds).toEqual(["h"]);
    });

    test("残りに、本番のレベル1と同じく3マスの長い車があること", () => {
      const longVehicleIds =
        released.boardState.puzzle.remainingVehicleIds.filter(
          (vehicleId) => getVehicle(vehicleId).length === 3,
        );

      expect(longVehicleIds.length).toBeGreaterThan(0);
    });
  });
});

describe("findParkingJamTutorialContact", () => {
  const blockedMoves = listBlockedMovesOnReachableStates();

  test("出庫を続けてたどり着くどの盤面でも、出られない手のあとに、どう出すかを言えること", () => {
    const released = playSteps(steps.length);
    const withoutFix = blockedMoves.filter(({ puzzle, move }) => {
      const progress = perform(
        { ...released, boardState: { ...released.boardState, puzzle } },
        move.vehicleId,
        move.direction,
      );
      return getMessage(progress).detail === null;
    });

    expect(withoutFix).toEqual([]);
  });

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

describe("findParkingJamTutorialDecider", () => {
  function findDecider(progress: Progress) {
    return findParkingJamTutorialDecider(
      getTutorialSituation(parkingJamTutorial, progress),
      progress.boardState,
    );
  }

  const deciderCases = (["road", "planter", "car"] as const).map((ruleId) => {
    const before = playSteps(findStepIndex(ruleId));
    return {
      ruleId,
      stepVehicleId: steps[findStepIndex(ruleId)]?.vehicleId,
      puzzle: before.boardState.puzzle,
      decider: findDecider(before),
    };
  });

  test.each(deciderCases)(
    "$ruleId を示す手順の決め手が、そのルールで出られない手と、その手で当たるものであること",
    ({ ruleId, puzzle, decider }) => {
      const blocker =
        decider && findParkingJamTutorialBlocker(puzzle, decider.move);

      expect(blocker).toBe(ruleId);
    },
  );

  test.each(deciderCases)(
    "$ruleId を示す手順の決め手の手が、印の車のもう片方の向きか、印の車に塞がれた車の手であること",
    ({ stepVehicleId, decider }) => {
      const otherDirection = decider?.move.vehicleId === stepVehicleId;
      const blockedByStepVehicle =
        decider?.contact.blocker.kind === "vehicle" &&
        decider.contact.blocker.vehicleId === stepVehicleId;

      expect(otherDirection || blockedByStepVehicle).toBe(true);
    },
  );

  describe("ほかの車のルールを示す手順", () => {
    const index = findStepIndex("car");
    const decider = findDecider(playSteps(index));
    const after = playSteps(index + 1).boardState.puzzle;

    test("印の車を出すと、決め手の車が塞がれていた向きへ出られるようになること", () => {
      const contact =
        decider && findParkingJamTutorialContact(after, decider.move);

      expect(decider).not.toBeNull();
      expect(contact).toBeNull();
    });
  });

  const noDeciderCases = [
    ["操作を見せる手順", started],
    ["手を離した後", playSteps(steps.length)],
  ] as const;

  test.each(noDeciderCases)("%sは決め手を返さないこと", (_, progress) => {
    const decider = findDecider(progress);

    expect(decider).toBeNull();
  });
});

describe("performTutorialAction", () => {
  const [first, second] = steps;
  const firstVehicleId = first?.vehicleId ?? "";
  const secondVehicleId = second?.vehicleId ?? "";
  const afterFirstStep = playSteps(1);
  const carStepIndex = findStepIndex("car");
  const beforeCarStep = playSteps(carStepIndex);
  const blockedMove = steps[carStepIndex]?.ruledOutMove ?? {
    vehicleId: "",
    direction: "left",
  };

  test("手を引いている間は、印の無い車を動かしても受け付けないこと", () => {
    const ignored = perform(started, secondVehicleId, "right");

    expect(ignored).toBe(started);
  });

  test("印の車を出すと、盤面から出して次の手順へ進むこと", () => {
    const exited = perform(started, firstVehicleId, "right");

    expect(exited.boardState.puzzle.remainingVehicleIds).not.toContain(
      firstVehicleId,
    );
    expect(exited.boardState.lastMove).toEqual({
      vehicleId: firstVehicleId,
      direction: "right",
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
    expect(message).toEqual({
      headline: "この先は道路につながっていません",
      detail: "反対の向きへ出します",
    });
    expect(blocked.boardState.lastMove).toMatchObject({
      type: "blocked",
      blocker: "road",
      contact: { blocker: { kind: "wall" } },
    });
  });

  test("ほかの車のルールを示す手順で、印の車に塞がれた車を動かしても受け付けないこと", () => {
    const ignored = perform(
      beforeCarStep,
      blockedMove.vehicleId,
      blockedMove.direction,
    );

    expect(ignored).toBe(beforeCarStep);
  });

  const stepViolationCases = [
    ["road", "b", "left", "この先は道路につながっていません"],
    ["planter", "c", "right", "植え込みにぶつかりました"],
    ["car", "d", "down", "ほかの車にぶつかりました"],
  ] as const satisfies readonly (readonly [
    ParkingJamTutorialRuleId,
    ParkingJamVehicleId,
    ParkingJamDirection,
    string,
  ])[];
  const stepViolations = stepViolationCases.map(
    ([ruleId, vehicleId, direction, headline]) => {
      const before = playSteps(findStepIndex(ruleId));
      return {
        ruleId,
        vehicleId,
        direction,
        headline,
        stepHeadline: getMessage(before).headline,
        before,
      };
    },
  );

  test.each(stepViolations)(
    "$ruleId を示す手順で印の車を出られない向きへ動かすと、手順の見出しから、ぶつかったものと、反対の向きへ出すことを言う一言に替わること",
    ({ before, vehicleId, direction, headline, stepHeadline }) => {
      const blocked = perform(before, vehicleId, direction);
      const message = getMessage(blocked);

      expect(message).toEqual({ headline, detail: "反対の向きへ出します" });
      expect(message.headline).not.toBe(stepHeadline);
    },
  );

  describe("手を離した後の場合", () => {
    const released = playSteps(steps.length);
    const blockedByCar = perform(released, "h", "left");

    const blockedCases = [
      [
        "反対の向きへは出られる車を、進む先に道路がない向き",
        "e",
        "right",
        {
          headline: "この先は道路につながっていません",
          detail: "反対の向きへ出します",
        },
      ],
      [
        "反対の向きも塞がれた車を、進む先に道路がない向き",
        "h",
        "right",
        {
          headline: "この先は道路につながっていません",
          detail: "左の車を先に出します",
        },
      ],
      [
        "反対の向きに道路がない車を、ほかの車がある向き",
        "h",
        "left",
        {
          headline: "ほかの車にぶつかりました",
          detail: "左の車を先に出します",
        },
      ],
    ] as const;

    test.each(blockedCases)(
      "%sへ出そうとすると、ぶつかったものと、どう出すかを言うこと",
      (_, vehicleId, direction, expected) => {
        const blocked = perform(released, vehicleId, direction);
        const message = getMessage(blocked);

        expect(blocked.violated).toBe(true);
        expect(message).toEqual(expected);
      },
    );

    describe("同じ側のほかの車線には道路がある向きの場合", () => {
      const laneCases = (
        [
          ["e", "right"],
          ["h", "right"],
        ] as const
      ).map(([vehicleId, direction]) => ({
        vehicleId,
        direction,
        roadOnSameSide: board.roadOpenings.some(
          ({ side }) => side === direction,
        ),
      }));

      test.each(laneCases)(
        "$vehicleId を $direction へ出そうとすると、その側の道路ではなく、進む先の車線に道路がないことを言うこと",
        ({ vehicleId, direction, roadOnSameSide }) => {
          const blocked = perform(released, vehicleId, direction);
          const message = getMessage(blocked);

          expect(roadOnSameSide).toBe(true);
          expect(message.headline).toBe("この先は道路につながっていません");
        },
      );
    });

    test("次に車を出すと、違反の一言を下げて残りを出す一言に戻すこと", () => {
      const exited = perform(blockedByCar, "g", "left");
      const message = getMessage(exited);

      expect(exited.violated).toBe(false);
      expect(message).toBe(parkingJamTutorial.freePlay);
    });
  });
});

describe("getParkingJamTutorialStepMove", () => {
  const situations = [started, playSteps(steps.length)].map((progress) =>
    getTutorialSituation(parkingJamTutorial, progress),
  );

  test("手を引いている間は手順の車と出させる向きを、手を離した後は何も返さないこと", () => {
    const moves = situations.map(getParkingJamTutorialStepMove);

    expect(moves).toEqual([{ vehicleId: "a", direction: "right" }, null]);
  });

  test.each(steps.map((step, index) => ({ index, step })))(
    "$index 番目の手順で出させる向きが、その手順の盤面で出られる向きであること",
    ({ index, step }) => {
      const { puzzle } = playSteps(index).boardState;
      const blocker = findParkingJamTutorialBlocker(puzzle, {
        vehicleId: step.vehicleId,
        direction: step.exitDirection,
      });

      expect(blocker).toBeNull();
    },
  );
});

describe("findParkingJamTutorialHint", () => {
  const released = playSteps(steps.length);
  const goal = parkingJamTutorial.goal();

  test("手を離した直後は、塞がれた車を通す車を示し、塞がれていた手を決め手として添えること", () => {
    const hint = findParkingJamTutorialHint(released.boardState);

    expect(hint).toMatchObject({
      vehicleId: "g",
      clearedMove: {
        move: { vehicleId: "h", direction: "left" },
        contact: { blocker: { kind: "vehicle", vehicleId: "g" } },
      },
    });
    expect(hint && describeParkingJamTutorialHint(hint).headline).toBe(
      "この車を先に出します",
    );
  });

  test("塞がれた車が無ければ、今出せる車を示し、今出せることを言うこと", () => {
    const progress = perform(released, "g", "left");
    const hint = findParkingJamTutorialHint(progress.boardState);

    expect(hint?.clearedMove).toBeNull();
    expect(hint && canExit(progress.boardState.puzzle, hint.vehicleId)).toBe(
      true,
    );
    expect(hint && describeParkingJamTutorialHint(hint).headline).toBe(
      "この車は今出せます",
    );
  });

  test("示された車を出せる向きへ出し続けると、すべての車を出し終えること", () => {
    let progress = released;
    for (let turn = 0; turn < 10 && progress.phase === "playing"; turn += 1) {
      const vehicleId =
        findParkingJamTutorialHint(progress.boardState)?.vehicleId ?? "";
      const direction = listDirections(vehicleId).find(
        (candidate) =>
          findParkingJamTutorialBlocker(progress.boardState.puzzle, {
            vehicleId,
            direction: candidate,
          }) === null,
      );
      progress = perform(progress, vehicleId, direction ?? "left");
    }

    expect(progress.phase).toBe("solved");
  });

  test("出し終えた盤面では何も示さないこと", () => {
    const hint = findParkingJamTutorialHint(goal);

    expect(hint).toBeNull();
  });
});

describe("getParkingJamTutorialProgressRatio", () => {
  const progresses = [started, playSteps(1), playSteps(steps.length)];
  const goal = parkingJamTutorial.goal();

  test("始めの盤面の車のうち、出し終えた車の割合を返すこと", () => {
    const ratios = progresses.map(({ boardState }) =>
      getParkingJamTutorialProgressRatio(boardState),
    );

    expect(ratios).toEqual([
      0,
      1 / PARKING_JAM_TUTORIAL_PROGRESS_STEP_COUNT,
      steps.length / PARKING_JAM_TUTORIAL_PROGRESS_STEP_COUNT,
    ]);
  });

  test("すべての車を出し終えた盤面で1を返すこと", () => {
    const ratio = getParkingJamTutorialProgressRatio(goal);

    expect(ratio).toBe(1);
  });
});

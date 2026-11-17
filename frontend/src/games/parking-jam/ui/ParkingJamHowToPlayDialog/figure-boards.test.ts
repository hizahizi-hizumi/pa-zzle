import {
  createParkingJamInitialState,
  isParkingJamCleared,
  type ParkingJamBoard,
  type ParkingJamMove,
  type ParkingJamState,
  validateParkingJamBoard,
} from "@/games/parking-jam/puzzle/board";
import {
  applyParkingJamMove,
  listParkingJamMoveBlockers,
} from "@/games/parking-jam/puzzle/rules";
import {
  carRuleExample,
  goalFigure,
  planterRuleExample,
  roadRuleExample,
  straightRuleExample,
  swipeOperationExample,
  tapOperationExample,
} from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-boards";

/** 本番の遷移で、手を順に打った盤面。通らない手があれば `null`。 */
function applyMoves(
  board: ParkingJamBoard,
  moves: readonly ParkingJamMove[],
): ParkingJamState | null {
  let state: ParkingJamState | null = createParkingJamInitialState(board);
  for (const move of moves) {
    state = state && applyParkingJamMove(board, state, move);
  }
  return state;
}

/** 始まりの盤面で、手に当たる物の種類。 */
function listInitialBlockerKinds(
  board: ParkingJamBoard,
  move: ParkingJamMove,
): string[] {
  return listParkingJamMoveBlockers(
    board,
    createParkingJamInitialState(board),
    move,
  ).map(({ kind }) => kind);
}

const examples = {
  straightRuleExample,
  roadRuleExample,
  planterRuleExample,
  carRuleExample,
  swipeOperationExample,
  tapOperationExample,
};

describe.each(Object.entries(examples))("%s", (_, example) => {
  test("本番の盤面の決まりに合う盤面であること", () => {
    const validate = () => validateParkingJamBoard(example.board);

    expect(validate).not.toThrow();
  });

  test("例が見せる手のうち、最後の手の前までを本番の遷移で順に打てること", () => {
    const state = applyMoves(example.board, example.moves.slice(0, -1));

    expect(state).not.toBeNull();
  });
});

describe("straightRuleExample", () => {
  test("車が上にも下にも出られること", () => {
    const blockers = (["up", "down"] as const).map((direction) =>
      listInitialBlockerKinds(straightRuleExample.board, {
        vehicleId: "a",
        direction,
      }),
    );

    expect(blockers).toEqual([[], []]);
  });
});

describe("roadRuleExample", () => {
  test("右の辺に道路があっても、車の車線に道路が無いので右へは道路が無いことで出られないこと", () => {
    const rightOpenings = roadRuleExample.board.roadOpenings.filter(
      ({ side }) => side === "right",
    ).length;
    const blockers = listInitialBlockerKinds(roadRuleExample.board, {
      vehicleId: "a",
      direction: "right",
    });

    expect(rightOpenings).toBe(1);
    expect(blockers).toEqual(["wall"]);
  });
});

describe("planterRuleExample", () => {
  test("右は同じ車線に道路があり、植え込みにだけ当たって出られないこと", () => {
    const blockers = listInitialBlockerKinds(planterRuleExample.board, {
      vehicleId: "a",
      direction: "right",
    });

    expect(blockers).toEqual(["fixed-area"]);
  });
});

describe.each([
  { name: "roadRuleExample", example: roadRuleExample, blocker: "wall" },
  {
    name: "planterRuleExample",
    example: planterRuleExample,
    blocker: "fixed-area",
  },
])("$name", ({ example, blocker }) => {
  test("例が見せる手は、例が教えるルールで出られない手であること", () => {
    const [move] = example.moves;
    const blockers = move ? listInitialBlockerKinds(example.board, move) : [];

    expect(example.moves).toHaveLength(1);
    expect(blockers).toEqual([blocker]);
  });
});

describe("carRuleExample", () => {
  test("印を付けない手は、例が教えるルールと別の道路のルールで出られない手であること", () => {
    const blockers = (carRuleExample.unmarkedMoves ?? []).map((move) =>
      listInitialBlockerKinds(carRuleExample.board, move),
    );

    expect(blockers).toEqual([["wall"]]);
  });

  test("例が見せる手を、本番の遷移ですべて打てること", () => {
    const state = applyMoves(carRuleExample.board, carRuleExample.moves);

    expect(state).not.toBeNull();
  });

  test("2マスの車は、始まりの盤面では右がほかの車に当たり、左は道路が無いこと", () => {
    const blockers = (["right", "left"] as const).map((direction) =>
      listInitialBlockerKinds(carRuleExample.board, {
        vehicleId: "a",
        direction,
      }),
    );

    expect(blockers).toEqual([["vehicle"], ["wall"]]);
  });

  test("じゃまな車は3マスの車で、上にも下にも出られること", () => {
    const vehicle = carRuleExample.board.vehicles.find(({ id }) => id === "b");
    const blockers = (["up", "down"] as const).map((direction) =>
      listInitialBlockerKinds(carRuleExample.board, {
        vehicleId: "b",
        direction,
      }),
    );

    expect(vehicle?.length).toBe(3);
    expect(blockers).toEqual([[], []]);
  });
});

describe("goalFigure", () => {
  test("本番の盤面の決まりに合う盤面であること", () => {
    const validate = () => validateParkingJamBoard(goalFigure.board);

    expect(validate).not.toThrow();
  });

  test("1台ずつ出す手を本番の遷移で順に打つと、すべての車が出てクリアになること", () => {
    const state = applyMoves(goalFigure.board, goalFigure.moves);

    expect(state).not.toBeNull();
    expect(state && isParkingJamCleared(state)).toBe(true);
  });

  test("植え込みと、2マスの車と3マスの車があること", () => {
    const lengths = new Set(
      goalFigure.board.vehicles.map(({ length }) => length),
    );
    const planters = goalFigure.board.fixedAreas.length;

    expect([...lengths].sort()).toEqual([2, 3]);
    expect(planters).toBeGreaterThan(0);
  });
});

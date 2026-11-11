import { assertTsumeShogiProblem } from "@/games/tsume-shogi/problem/problem";
import { isTsumeShogiMateWithin } from "@/games/tsume-shogi/puzzle/mate-search";
import {
  applyTsumeShogiMove,
  isSameTsumeShogiMove,
  isTsumeShogiCheckmate,
  listTsumeShogiAttackerChecks,
  listTsumeShogiDefenderResponses,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  getTsumeShogiPieceAt,
  type TsumeShogiPosition,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import {
  getTsumeShogiSessionPhase,
  isTsumeShogiSessionOnWrongLine,
} from "@/games/tsume-shogi/session/session";
import {
  _private,
  canUndoTsumeShogiTutorial,
  describeTsumeShogiTutorialFreePlay,
  describeTsumeShogiTutorialStep,
  findTsumeShogiTutorialHint,
  getTsumeShogiTutorialProgressRatio,
  getTsumeShogiTutorialStepCue,
  TSUME_SHOGI_TUTORIAL_PROGRESS_STEP_COUNT,
  type TsumeShogiTutorialAction,
  type TsumeShogiTutorialBoardState,
  type TsumeShogiTutorialCue,
  type TsumeShogiTutorialRuleId,
  type TsumeShogiTutorialStep,
  tsumeShogiTutorial,
} from "@/games/tsume-shogi/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

const { problem, attackerMainLine } = _private;
const { steps } = tsumeShogiTutorial;

type Progress = TutorialProgress<
  TsumeShogiTutorialRuleId,
  TsumeShogiTutorialBoardState
>;

const allSquares: readonly TsumeShogiSquare[] = Array.from(
  { length: 81 },
  (_, index) => ({ file: (index % 9) + 1, rank: Math.floor(index / 9) + 1 }),
);

/** 手を離した後に自分で指す攻方の手。 */
const freeMoves = attackerMainLine.slice(steps.length);

function perform(progress: Progress, action: TsumeShogiTutorialAction) {
  return performTutorialAction(tsumeShogiTutorial, progress, action);
}

/** 指で指した所を押す。 */
function pressCue(progress: Progress, cue: TsumeShogiTutorialCue): Progress {
  switch (cue.type) {
    case "square":
      return perform(progress, { type: "square", square: cue.square });
    case "hand":
      return perform(progress, { type: "hand", pieceType: cue.pieceType });
    case "undo":
      return perform(progress, { type: "undo" });
  }
}

/** 駒（持駒）を選び、行き先の升を押す。成・不成を選ぶときは手のとおりに選ぶ。 */
function selectAndPlay(progress: Progress, move: TsumeShogiMove): Progress {
  const selected = perform(
    progress,
    move.kind === "drop"
      ? { type: "hand", pieceType: move.pieceType }
      : { type: "square", square: move.from },
  );
  const played = perform(selected, { type: "square", square: move.to });
  return played.boardState.promotionChoice
    ? perform(played, {
        type: "promotion",
        promote: move.kind === "board" && move.promote,
      })
    : played;
}

/** 手順の手を、指で指した所を押して指し、玉方の応手を盤面に指す。 */
function playGuidedStep(progress: Progress): Progress {
  let current = progress;
  for (let press = 0; press < 2; press += 1) {
    const { step } = getTutorialSituation(tsumeShogiTutorial, current);
    const cue = step && getTsumeShogiTutorialStepCue(step, current.boardState);
    if (!cue) {
      throw new Error("指で指す所がありません");
    }
    current = pressCue(current, cue);
  }
  return perform(current, { type: "defender-reply" });
}

function startPlaying(): Progress {
  return finishTutorialIntro(startTutorial(tsumeShogiTutorial));
}

/** 手順をすべて終えて手を離した進行。 */
function playAllSteps(): Progress {
  return steps.reduce(playGuidedStep, startPlaying());
}

/** 王手のうち、残りの手数以内に詰む手。 */
function listMatingChecks(
  position: TsumeShogiPosition,
  remainingPlies: number,
): TsumeShogiMove[] {
  return listTsumeShogiAttackerChecks(position).filter((check) =>
    isTsumeShogiMateWithin(
      applyTsumeShogiMove(position, check),
      remainingPlies - 1,
    ),
  );
}

/** 作意を、攻方の `count` 手まで（玉方の応手を含めて）指した局面と残りの手数。 */
function getMainLinePosition(count: number): {
  position: TsumeShogiPosition;
  remainingPlies: number;
} {
  const plies = count * 2;
  return {
    position: problem.mainLine
      .slice(0, plies)
      .reduce(applyTsumeShogiMove, problem.initialPosition),
    remainingPlies: problem.plies - plies,
  };
}

function isSameRoute(left: TsumeShogiMove, right: TsumeShogiMove): boolean {
  return (
    left.kind === "board" &&
    right.kind === "board" &&
    left.from.file === right.from.file &&
    left.from.rank === right.from.rank &&
    left.to.file === right.to.file &&
    left.to.rank === right.to.rank
  );
}

describe("盤面", () => {
  const replyPlies = problem.mainLine.flatMap((_, ply) =>
    ply % 2 === 1 ? [ply] : [],
  );
  const attackerCases = attackerMainLine.map(
    (move, index) => [index, move] as const,
  );

  test("本番と同じ確かめ方で、問題として成り立つこと", () => {
    const act = () => assertTsumeShogiProblem(problem);

    expect(act).not.toThrow();
  });

  test("作意の手数より短くは詰まないこと", () => {
    const mates = isTsumeShogiMateWithin(
      problem.initialPosition,
      problem.plies - 2,
    );

    expect(mates).toBe(false);
  });

  test.each(replyPlies)(
    "玉方の作意の応手が、駒を取らない玉の移動で、ほかの応手より早く詰まないこと: %i手目",
    (ply) => {
      const before = problem.mainLine
        .slice(0, ply)
        .reduce(applyTsumeShogiMove, problem.initialPosition);
      const reply = problem.mainLine[ply] as TsumeShogiMove;
      const remaining = problem.plies - ply - 1;

      const movedPiece =
        reply.kind === "board"
          ? getTsumeShogiPieceAt(before, reply.from)
          : null;
      const captured = getTsumeShogiPieceAt(before, reply.to);
      const matesEarlier = isTsumeShogiMateWithin(
        applyTsumeShogiMove(before, reply),
        remaining - 2,
      );
      const everyReplyMates = listTsumeShogiDefenderResponses(before).every(
        (other) =>
          isTsumeShogiMateWithin(applyTsumeShogiMove(before, other), remaining),
      );

      expect(movedPiece?.type).toBe("king");
      expect(captured).toBeNull();
      expect(matesEarlier).toBe(false);
      expect(everyReplyMates).toBe(true);
    },
  );

  test.each(attackerCases)(
    "攻方の作意の手が、成・不成を選ばずに指せること: 攻方の%i手目",
    (index, move) => {
      const { position } = getMainLinePosition(index);

      const sameRoute = listTsumeShogiAttackerChecks(position).filter((check) =>
        isSameRoute(check, move),
      );

      expect(sameRoute.length).toBeLessThanOrEqual(1);
    },
  );

  test("詰み上がりの盤面が、作意を指し終えた詰みの局面であること", () => {
    const goal = tsumeShogiTutorial.goal();

    expect(isTsumeShogiCheckmate(goal.puzzleState)).toBe(true);
    expect(goal.turns).toHaveLength(attackerMainLine.length);
  });
});

describe("手を引く間の場合", () => {
  const stepCases = steps.map((step, index) => [index, step] as const);

  test.each(stepCases)(
    "手順の手が作意の手で、それまでに伝えたルールで指せる、残りの手数以内に詰む王手であること: 手順%i",
    (index, step) => {
      const { position, remainingPlies } = getMainLinePosition(index);
      const earned = steps
        .slice(0, index + 1)
        .flatMap(({ introducedRuleId }) =>
          introducedRuleId === null ? [] : [introducedRuleId],
        );

      const mating = listMatingChecks(position, remainingPlies).some((check) =>
        isSameTsumeShogiMove(check, step.move),
      );

      expect(isSameTsumeShogiMove(step.move, attackerMainLine[index]!)).toBe(
        true,
      );
      expect(mating).toBe(true);
      expect(earned).toContain("check");
      expect(step.move.kind !== "drop" || earned.includes("drop")).toBe(true);
    },
  );

  test("伝えるルールのそれぞれが、1つ以上の手順の手の決め手になること", () => {
    const checkStep = steps.find(
      ({ introducedRuleId }) => introducedRuleId === "check",
    );
    const dropStep = steps.find(
      ({ introducedRuleId }) => introducedRuleId === "drop",
    );

    expect(checkStep).toBe(steps[0]);
    expect(dropStep?.move.kind).toBe("drop");
  });

  test.each(steps.map((step, index) => [index, step] as const))(
    "手順の手が、その局面で詰みへ向かうただ1つの王手で、王手のルールで決まること: 手順%i",
    (index, step) => {
      const { position, remainingPlies } = getMainLinePosition(index);

      const mating = listMatingChecks(position, remainingPlies);

      expect(mating).toHaveLength(1);
      expect(isSameTsumeShogiMove(mating[0]!, step.move)).toBe(true);
    },
  );

  describe("手順を進めていく場合", () => {
    const stepStarts = steps.map((step, index) => {
      const progress = steps
        .slice(0, index)
        .reduce(playGuidedStep, startPlaying());
      return {
        progress,
        cue: getTsumeShogiTutorialStepCue(step, progress.boardState),
      };
    });

    test("指で指した升のほかは、どの升を押しても、待ったを押しても盤面を変えないこと", () => {
      const changedSquares = stepStarts.flatMap(({ progress, cue }) =>
        allSquares.filter((square) => {
          const pressed = perform(progress, { type: "square", square });
          const isCue =
            cue?.type === "square" &&
            cue.square.file === square.file &&
            cue.square.rank === square.rank;
          return pressed !== progress && !isCue;
        }),
      );
      const undoIgnored = stepStarts.map(
        ({ progress }) => perform(progress, { type: "undo" }) === progress,
      );

      expect(changedSquares).toEqual([]);
      expect(undoIgnored.every(Boolean)).toBe(true);
    });

    test("指した所を押して玉方が応じると次の手順へ進み、手順をすべて終えると手を離すこと", () => {
      const progress = playAllSteps();

      expect(progress.stepIndex).toBe(steps.length);
      expect(progress.violated).toBe(false);
      expect(progress.earnedRuleIds).toEqual(["check", "drop"]);
    });
  });

  describe("操作を教える手順で駒を選んだ場合", () => {
    const [first] = steps as [TsumeShogiTutorialStep];
    const progress = startPlaying();
    const selected = pressCue(
      progress,
      getTsumeShogiTutorialStepCue(first, progress.boardState)!,
    );

    test("行き先の一言へ替え、行き先の升を指すこと", () => {
      const before = describeTsumeShogiTutorialStep(first, progress.boardState);
      const after = describeTsumeShogiTutorialStep(first, selected.boardState);
      const cue = getTsumeShogiTutorialStepCue(first, selected.boardState);

      expect(before).toBe(first.message);
      expect(after).toBe(first.destinationMessage);
      expect(cue).toEqual({ type: "square", square: first.move.to });
    });

    test("指した後、玉方が応じるまで、行き先の一言のままにすること", () => {
      const played = pressCue(selected, {
        type: "square",
        square: first.move.to,
      });

      const message = describeTsumeShogiTutorialStep(first, played.boardState);

      expect(played.boardState.defenderReplyPending).toBe(true);
      expect(message).toBe(first.destinationMessage);
    });
  });
});

describe("手を離した後の場合", () => {
  const decision = playAllSteps();
  const freeCases = freeMoves.map((move, offset) => [offset, move] as const);

  test("自分で指す手が、指で指して指させる手の数以上あること", () => {
    const freeCount = freeMoves.length;

    expect(freeCount).toBeGreaterThanOrEqual(steps.length);
  });

  test.each(freeCases)(
    "王手が3つ以上ある中で、残りの手数以内に詰む王手が半分に満たない、盤面を読んで選ぶ手であること: 手を離して%i手目",
    (offset, move) => {
      const { position, remainingPlies } = getMainLinePosition(
        steps.length + offset,
      );

      const checks = listTsumeShogiAttackerChecks(position);
      const mating = listMatingChecks(position, remainingPlies);

      expect(checks.length).toBeGreaterThanOrEqual(3);
      expect(mating.length * 2).toBeLessThan(checks.length);
      expect(mating.some((check) => isSameTsumeShogiMove(check, move))).toBe(
        true,
      );
    },
  );

  test("最初の手が、残りの手数以内に詰むただ1つの王手であること", () => {
    const { position, remainingPlies } = getMainLinePosition(steps.length);

    const mating = listMatingChecks(position, remainingPlies);

    expect(mating).toHaveLength(1);
    expect(isSameTsumeShogiMove(mating[0]!, freeMoves[0]!)).toBe(true);
  });

  test("最初の手が、同じ持駒を玉の上から打つ王手では詰まず、手順の手を繰り返すだけでは見つからないこと", () => {
    const [firstFree] = freeMoves;
    const { position, remainingPlies } = getMainLinePosition(steps.length);

    const headDrops = listTsumeShogiAttackerChecks(position).filter(
      (check) =>
        check.kind === "drop" &&
        firstFree?.kind === "drop" &&
        check.to.file === firstFree.to.file &&
        check.to.rank < firstFree.to.rank,
    );
    const headDropMates = headDrops.some((check) =>
      isTsumeShogiMateWithin(
        applyTsumeShogiMove(position, check),
        remainingPlies - 1,
      ),
    );

    expect(firstFree?.kind).toBe("drop");
    expect(headDrops.length).toBeGreaterThan(0);
    expect(headDropMates).toBe(false);
  });

  test("作意どおりに指すと詰み、進み具合が手順の分から1まで進むこと", () => {
    const solved = freeMoves.reduce(
      (progress, move) =>
        perform(selectAndPlay(progress, move), { type: "defender-reply" }),
      decision,
    );

    expect(getTsumeShogiTutorialProgressRatio(decision.boardState)).toBe(
      steps.length / TSUME_SHOGI_TUTORIAL_PROGRESS_STEP_COUNT,
    );
    expect(solved.phase).toBe("solved");
    expect(isTsumeShogiCheckmate(solved.boardState.puzzleState)).toBe(true);
    expect(getTsumeShogiTutorialProgressRatio(solved.boardState)).toBe(1);
  });

  describe("詰まない王手を指して玉方が逃れた場合", () => {
    const wrongChecks = listTsumeShogiAttackerChecks(
      decision.boardState.puzzleState,
    ).filter((check) => !isSameTsumeShogiMove(check, freeMoves[0]!));

    test.each(wrongChecks)(
      "すぐ待ったを指し、逃げたか駒を取ったかを言い、進み具合を変えず、待ったで判断地点へ戻ること: %o",
      (check) => {
        const escaped = perform(selectAndPlay(decision, check), {
          type: "defender-reply",
        });
        const undone = perform(escaped, { type: "undo" });
        const lastTurn = escaped.boardState.turns.at(-1)!;
        const captured =
          getTsumeShogiPieceAt(
            lastTurn.positionAfterAttack,
            lastTurn.defenderMove!.to,
          ) !== null;

        expect(isTsumeShogiSessionOnWrongLine(escaped.boardState)).toBe(true);
        expect(findTsumeShogiTutorialHint(escaped.boardState, false)).toEqual({
          type: "undo",
        });
        expect(
          describeTsumeShogiTutorialFreePlay(escaped.boardState).headline,
        ).toBe(
          captured
            ? "玉に駒を取られました\n待ったを押して戻しましょう"
            : "玉に逃げられました\n待ったを押して戻しましょう",
        );
        expect(getTsumeShogiTutorialProgressRatio(escaped.boardState)).toBe(
          getTsumeShogiTutorialProgressRatio(decision.boardState),
        );
        expect(undone.boardState.turns).toEqual(decision.boardState.turns);
      },
    );
  });

  describe("最初の手を指した後の判断地点で、詰まない王手を指して玉方が逃れた場合", () => {
    const secondDecision = perform(selectAndPlay(decision, freeMoves[0]!), {
      type: "defender-reply",
    });
    const wrongChecks = listTsumeShogiAttackerChecks(
      secondDecision.boardState.puzzleState,
    ).filter(
      (check) =>
        !isTsumeShogiCheckmate(
          applyTsumeShogiMove(secondDecision.boardState.puzzleState, check),
        ),
    );

    test.each(wrongChecks)(
      "すぐ待ったを指し、待ったでその判断地点へ戻って、詰ませる手を指せること: %o",
      (check) => {
        const escaped = perform(selectAndPlay(secondDecision, check), {
          type: "defender-reply",
        });
        const undone = perform(escaped, { type: "undo" });
        const solved = selectAndPlay(undone, freeMoves[1]!);

        expect(findTsumeShogiTutorialHint(escaped.boardState, false)).toEqual({
          type: "undo",
        });
        expect(undone.boardState.turns).toEqual(
          secondDecision.boardState.turns,
        );
        expect(solved.phase).toBe("solved");
      },
    );
  });

  describe("2つ目の判断地点で、詰まない王手を手数が尽きるまで続けた場合", () => {
    const secondDecision = perform(selectAndPlay(decision, freeMoves[0]!), {
      type: "defender-reply",
    });
    const wrongCheck = listTsumeShogiAttackerChecks(
      secondDecision.boardState.puzzleState,
    ).find(
      (check) =>
        !isTsumeShogiCheckmate(
          applyTsumeShogiMove(secondDecision.boardState.puzzleState, check),
        ),
    )!;

    test("これ以上指せなくなった盤面でも待ったを指し、待ったでその判断地点へ戻ること", () => {
      const refuted = perform(selectAndPlay(secondDecision, wrongCheck), {
        type: "defender-reply",
      });
      const undone = perform(refuted, { type: "undo" });

      expect(getTsumeShogiSessionPhase(refuted.boardState)).toBe("refuted");
      expect(findTsumeShogiTutorialHint(refuted.boardState, false)).toEqual({
        type: "undo",
      });
      expect(undone.boardState.turns).toEqual(secondDecision.boardState.turns);
    });
  });

  describe("2つ目の判断地点で、作意と別の詰ませる手を指した場合", () => {
    const secondDecision = perform(selectAndPlay(decision, freeMoves[0]!), {
      type: "defender-reply",
    });
    const otherMates = listTsumeShogiAttackerChecks(
      secondDecision.boardState.puzzleState,
    ).filter(
      (check) =>
        !isSameTsumeShogiMove(check, freeMoves[1]!) &&
        isTsumeShogiCheckmate(
          applyTsumeShogiMove(secondDecision.boardState.puzzleState, check),
        ),
    );

    test.each(otherMates)("詰んで解き終えること: %o", (check) => {
      const solved = selectAndPlay(secondDecision, check);

      expect(solved.phase).toBe("solved");
      expect(getTsumeShogiTutorialProgressRatio(solved.boardState)).toBe(1);
    });
  });

  test("手が止まったときに指す所を押していくと、詰むこと", () => {
    let progress = decision;
    for (
      let press = 0;
      press < 20 && progress.phase === "playing";
      press += 1
    ) {
      const cue = findTsumeShogiTutorialHint(progress.boardState, true);
      progress = progress.boardState.defenderReplyPending
        ? perform(progress, { type: "defender-reply" })
        : pressCue(progress, cue!);
    }

    expect(progress.phase).toBe("solved");
  });

  test("手が止まるまでは、詰む王手を指さないこと", () => {
    const cue = findTsumeShogiTutorialHint(decision.boardState, false);

    expect(cue).toBeNull();
  });

  test("手順の手を、待ったで戻せないこと", () => {
    const undone = perform(decision, { type: "undo" });

    expect(canUndoTsumeShogiTutorial(decision.boardState)).toBe(false);
    expect(undone).toBe(decision);
  });

  describe("王手にならない手を指そうとした場合", () => {
    const selected = perform(decision, { type: "hand", pieceType: "gold" });

    test("着手させず、そのわけを言うこと", () => {
      const rejected = perform(selected, {
        type: "square",
        square: { file: 5, rank: 5 },
      });
      const message = getTutorialMessage(tsumeShogiTutorial, rejected, {
        entry: "home",
        violationSettled: true,
      });

      expect(rejected.violated).toBe(true);
      expect(message.headline).toBe("王手にならない手は指せません");
      expect(rejected.boardState.turns).toEqual(decision.boardState.turns);
    });
  });

  test("詰みへ向かう王手を指すと、残りの王手の数で応えること", () => {
    const advanced = perform(selectAndPlay(decision, freeMoves[0]!), {
      type: "defender-reply",
    });

    const before = describeTsumeShogiTutorialFreePlay(decision.boardState);
    const after = describeTsumeShogiTutorialFreePlay(advanced.boardState);

    expect(before).toEqual(tsumeShogiTutorial.freePlay);
    expect(after.headline).toBe("あと1回王手をかけて\n詰ませてみましょう");
    expect(getTsumeShogiSessionPhase(advanced.boardState)).toBe("attacker");
  });
});

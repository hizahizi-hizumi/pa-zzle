import { isTsumeShogiMateWithin } from "@/games/tsume-shogi/puzzle/mate-search";
import {
  applyTsumeShogiMove,
  formatTsumeShogiMoveUsi,
  isSameTsumeShogiMove,
  isTsumeShogiDefenderInCheck,
  listTsumeShogiAttackerChecks,
  listTsumeShogiDefenderResponses,
  listTsumeShogiLegalMoves,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  findTsumeShogiDefenderKing,
  formatTsumeShogiPosition,
  getTsumeShogiPieceAt,
  isSameTsumeShogiSquare,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import {
  getTsumeShogiSessionPhase,
  isTsumeShogiSessionOnWrongLine,
  type TsumeShogiSession,
} from "@/games/tsume-shogi/session/session";
import {
  _private,
  findTsumeShogiTutorialHint,
  getTsumeShogiTutorialMark,
  type TsumeShogiTutorialAction,
  type TsumeShogiTutorialBoardState,
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

const { problem, escapeSquare, escapingCheck, matingMove, playMove } = _private;
const { steps } = tsumeShogiTutorial;

type Progress = TutorialProgress<
  TsumeShogiTutorialRuleId,
  TsumeShogiTutorialBoardState
>;

const allSquares: readonly TsumeShogiSquare[] = Array.from(
  { length: 81 },
  (_, index) => ({ file: (index % 9) + 1, rank: Math.floor(index / 9) + 1 }),
);

function formatSquare({ file, rank }: TsumeShogiSquare): string {
  return `${file}-${rank}`;
}

function perform(progress: Progress, action: TsumeShogiTutorialAction) {
  return performTutorialAction(tsumeShogiTutorial, progress, action);
}

function selectAndPlay(progress: Progress, move: TsumeShogiMove): Progress {
  const selected = perform(
    progress,
    move.kind === "drop"
      ? { type: "hand", pieceType: move.pieceType }
      : { type: "square", square: move.from },
  );
  return perform(selected, { type: "square", square: move.to });
}

function playStep(progress: Progress, step: TsumeShogiTutorialStep): Progress {
  if (step.target.type === "undo") {
    return perform(progress, { type: "undo" });
  }
  return perform(selectAndPlay(progress, step.target.move), {
    type: "defender-reply",
  });
}

const started = finishTutorialIntro(startTutorial(tsumeShogiTutorial));

function playSteps(count: number): Progress {
  return steps.slice(0, count).reduce(playStep, started);
}

const released = playSteps(steps.length);

function getStepMove(step: TsumeShogiTutorialStep): TsumeShogiMove {
  if (step.target.type !== "move") {
    throw new Error("攻方の手の手順ではありません");
  }
  return step.target.move;
}

function playWithReply(session: TsumeShogiSession, move: TsumeShogiMove) {
  return perform(
    { ...released, boardState: playMove(session, move) },
    { type: "defender-reply" },
  ).boardState;
}

function toStateKey(session: TsumeShogiSession): string {
  return [
    formatTsumeShogiPosition(session.puzzleState),
    getTsumeShogiSessionPhase(session),
    session.turns.map((turn) => turn.line).join(","),
  ].join(" ");
}

function exploreFreePlay(
  start: TsumeShogiSession,
): Map<string, { session: TsumeShogiSession; nextKeys: string[] }> {
  const explored = new Map<
    string,
    { session: TsumeShogiSession; nextKeys: string[] }
  >();
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const session = queue[index] as TsumeShogiSession;
    const key = toStateKey(session);
    if (explored.has(key)) {
      continue;
    }
    const nextSessions: TsumeShogiSession[] = [];
    if (session.status !== "cleared") {
      const undone = perform(
        { ...released, boardState: session },
        { type: "undo" },
      ).boardState;
      if (undone !== session) {
        nextSessions.push(undone);
      }
      // 王手にならない手と指せない手は盤面を変えないので含めない。
      if (getTsumeShogiSessionPhase(session) === "attacker") {
        for (const check of listTsumeShogiAttackerChecks(session.puzzleState)) {
          nextSessions.push(playWithReply(session, check));
        }
      }
    }
    explored.set(key, {
      session,
      nextKeys: nextSessions.map(toStateKey),
    });
    queue.push(...nextSessions);
  }
  return explored;
}

const attackerTurns = [0, 2, 4].map((index) => ({
  position: problem.mainLine
    .slice(0, index)
    .reduce(applyTsumeShogiMove, problem.initialPosition),
  remainingPlies: problem.plies - index,
}));

describe("盤面", () => {
  const defenderResponseCounts = [1, 3].map(
    (index) =>
      listTsumeShogiDefenderResponses(
        problem.mainLine
          .slice(0, index)
          .reduce(applyTsumeShogiMove, problem.initialPosition),
      ).length,
  );

  test("3手では詰まず、5手で詰むこと", () => {
    const withinThree = isTsumeShogiMateWithin(problem.initialPosition, 3);
    const withinFive = isTsumeShogiMateWithin(problem.initialPosition, 5);

    expect(withinThree).toBe(false);
    expect(withinFive).toBe(true);
  });

  test("攻方のどの手番でも、残りの手数のうちに詰む王手が作意の手だけであること", () => {
    const matingChecks = attackerTurns.map(({ position, remainingPlies }) =>
      listTsumeShogiAttackerChecks(position)
        .filter((check) =>
          isTsumeShogiMateWithin(
            applyTsumeShogiMove(position, check),
            remainingPlies - 1,
          ),
        )
        .map(formatTsumeShogiMoveUsi),
    );

    expect(matingChecks).toEqual(
      [0, 2, 4].map((index) => [
        formatTsumeShogiMoveUsi(problem.mainLine[index]!),
      ]),
    );
  });

  test("作意の玉方の応手が、どれも1つに決まること", () => {
    const counts = defenderResponseCounts;

    expect(counts).toEqual([1, 1]);
  });

  const matedPosition = problem.mainLine.reduce(
    applyTsumeShogiMove,
    problem.initialPosition,
  );
  const attackerMoves = [
    ...problem.mainLine.filter((_, index) => index % 2 === 0),
    escapingCheck,
  ];

  test("ゴールの盤面が、作意を指し終えて玉が詰んだ盤面であること", () => {
    const goal = tsumeShogiTutorial.goal();

    expect(goal.status).toBe("cleared");
    expect(formatTsumeShogiPosition(goal.puzzleState)).toBe(
      formatTsumeShogiPosition(matedPosition),
    );
  });

  test("指させる攻方の手に、成る手が無いこと", () => {
    const promotable = attackerMoves.filter(
      (move) => move.kind === "board" && move.promote,
    );

    expect(promotable).toEqual([]);
  });
});

describe("手順", () => {
  test("最初の手順で、作意の初手を、持駒を打つ操作で指させること", () => {
    const [first] = steps;
    const move = first ? getStepMove(first) : null;

    expect(move?.kind).toBe("drop");
    expect(move && isSameTsumeShogiMove(move, problem.mainLine[0]!)).toBe(true);
  });

  test("2つ目の手順で、作意の3手目を、盤の駒を動かす操作で指させること", () => {
    const move = getStepMove(steps[1]!);

    expect(move.kind).toBe("board");
    expect(isSameTsumeShogiMove(move, problem.mainLine[2]!)).toBe(true);
  });

  const checkCases = steps.flatMap((step, index) =>
    step.target.type === "move" ? [[index + 1, step, index] as const] : [],
  );

  test.each(checkCases)(
    "%i つ目の手順の手が、伝えた王手のルールどおり、玉を取れる所へ指す王手であること",
    (_, step, index) => {
      const before = playSteps(index).boardState.puzzleState;
      const after = applyTsumeShogiMove(before, getStepMove(step));

      expect(isTsumeShogiDefenderInCheck(after)).toBe(true);
    },
  );

  describe("持駒を伝える手順の場合", () => {
    const index = steps.findIndex((step) => step.introducedRuleId === "drop");
    const move = getStepMove(steps[index]!);
    const before = playSteps(index).boardState.puzzleState;

    test("空いた升に持駒を打たせること", () => {
      const occupant = getTsumeShogiPieceAt(before, move.to);

      expect(move.kind).toBe("drop");
      expect(occupant).toBeNull();
    });
  });

  describe("逃げ道を伝える手順の場合", () => {
    const index = steps.findIndex((step) => step.introducedRuleId === "escape");
    const before = playSteps(index);
    const after = playStep(before, steps[index]!);
    const reply = after.boardState.turns.at(-1)?.defenderMove;
    const kingBefore = findTsumeShogiDefenderKing(
      before.boardState.puzzleState,
    );

    test("王手を指すと、玉が空いた升へ逃げ、この手数では詰まなくなること", () => {
      const phase = getTsumeShogiSessionPhase(after.boardState);

      expect(reply?.kind).toBe("board");
      expect(
        reply?.kind === "board" &&
          isSameTsumeShogiSquare(reply.from, kingBefore),
      ).toBe(true);
      expect(
        reply && getTsumeShogiPieceAt(before.boardState.puzzleState, reply.to),
      ).toBeNull();
      expect(phase).toBe("refuted");
    });

    test("決め手として見せる升へ、玉が逃げること", () => {
      const keySquares = steps[index]?.keySquares;

      expect(keySquares).toEqual([escapeSquare]);
      expect(
        reply?.kind === "board" &&
          isSameTsumeShogiSquare(reply.to, escapeSquare),
      ).toBe(true);
    });

    test("逃げる王手と詰ませる手の行き先が同じ升で、詰ませる手を自分で見比べられること", () => {
      const sameDestination = isSameTsumeShogiSquare(
        escapingCheck.to,
        matingMove.to,
      );

      expect(sameDestination).toBe(true);
    });

    test("次の手順で待ったを押すと、逃げられた王手の前の盤面へ戻ること", () => {
      const undone = playStep(after, steps[index + 1]!);

      expect(steps[index + 1]?.target.type).toBe("undo");
      expect(formatTsumeShogiPosition(undone.boardState.puzzleState)).toBe(
        formatTsumeShogiPosition(before.boardState.puzzleState),
      );
      expect(undone.stepIndex).toBe(steps.length);
    });
  });

  describe("ルールの決め手", () => {
    const freePosition = released.boardState.puzzleState;
    const checkStepIndex = steps.findIndex(
      (step) => step.introducedRuleId === "check",
    );
    const checkStepMove = getStepMove(steps[checkStepIndex]!);
    const checkStepPosition = playSteps(checkStepIndex).boardState.puzzleState;
    const escapingReplies = listTsumeShogiAttackerChecks(freePosition)
      .filter((check) => !isSameTsumeShogiMove(check, matingMove))
      .map((check) => {
        const after = applyTsumeShogiMove(freePosition, check);
        return listTsumeShogiDefenderResponses(after).map((reply) => ({
          reply,
          captures:
            reply.kind === "board" &&
            getTsumeShogiPieceAt(after, reply.to) !== null,
        }));
      });
    const decisive: Record<TsumeShogiTutorialRuleId, boolean> = {
      // 持駒: 手順で、空いた升に持駒を打つ。
      drop: steps.some(
        (step, index) =>
          step.target.type === "move" &&
          step.target.move.kind === "drop" &&
          getTsumeShogiPieceAt(
            playSteps(index).boardState.puzzleState,
            step.target.move.to,
          ) === null,
      ),
      // 王手: 王手を伝える手順で、印の駒の行き先のうち王手にならない升を外し、印の升は王手になる。
      check:
        checkStepMove.kind === "board" &&
        isTsumeShogiDefenderInCheck(
          applyTsumeShogiMove(checkStepPosition, checkStepMove),
        ) &&
        listTsumeShogiLegalMoves(checkStepPosition).some(
          (move) =>
            move.kind === "board" &&
            isSameTsumeShogiSquare(move.from, checkStepMove.from) &&
            !isTsumeShogiDefenderInCheck(
              applyTsumeShogiMove(checkStepPosition, move),
            ),
        ),
      // 逃げ道: 手を離した後、詰まない王手はどれも玉が空いた升へ逃げるか守られていない駒を取って外れ、
      // 逃げ道も取れる駒も残さない詰ませる手だけが残る。
      escape:
        escapingReplies.length > 0 &&
        escapingReplies.every(
          (replies) =>
            replies.length > 0 &&
            replies.every(({ reply }) => reply.kind === "board"),
        ) &&
        escapingReplies.some((replies) =>
          replies.some(({ captures }) => captures),
        ) &&
        listTsumeShogiDefenderResponses(
          applyTsumeShogiMove(freePosition, matingMove),
        ).length === 0,
    };

    test.each(tsumeShogiTutorial.rules.map(({ id }) => id))(
      "%s が、1つ以上の手を決めること",
      (ruleId) => {
        const decided = decisive[ruleId];

        expect(decided).toBe(true);
      },
    );
  });

  const sourceCases = steps.flatMap((step, index) =>
    step.target.type === "move"
      ? [[index + 1, step.target.move, playSteps(index)] as const]
      : [],
  );

  test.each(sourceCases)(
    "%i つ目の手順で印の駒を選んだ途中の盤面は、駒を選んだだけで、ルールに合わないところが無いこと",
    (_, move, before) => {
      const selected = perform(
        before,
        move.kind === "drop"
          ? { type: "hand", pieceType: move.pieceType }
          : { type: "square", square: move.from },
      );

      expect(selected.violated).toBe(false);
      expect(selected.boardState.rejection).toBeNull();
      expect(selected.boardState.turns).toBe(before.boardState.turns);
      expect(selected.boardState.selection).not.toBeNull();
    },
  );

  const guidedMoveCases = steps.flatMap((step, index) =>
    step.target.type === "move" &&
    step.target.move.kind === "board" &&
    playSteps(index)
      .earnedRuleIds.concat(step.introducedRuleId ?? [])
      .includes("check")
      ? [[index + 1, step.target.move, playSteps(index)] as const]
      : [],
  );

  test.each(guidedMoveCases)(
    "王手を伝えた後の %i つ目の手順で、印の駒の行き先のうち、王手にならない升はどれも着手させずにルールに合わない手として返すこと",
    (_, move, before) => {
      const selected = perform(before, {
        type: "square",
        square: move.kind === "board" ? move.from : move.to,
      });
      const accepted = allSquares.filter((square) => {
        const next = perform(selected, { type: "square", square });
        return (
          next !== selected &&
          !next.violated &&
          next.boardState.turns.length > selected.boardState.turns.length
        );
      });
      const violatedSquares = allSquares.filter(
        (square) => perform(selected, { type: "square", square }).violated,
      );
      const position = before.boardState.puzzleState;
      const nonCheckSquares = listTsumeShogiLegalMoves(position)
        .filter(
          (candidate) =>
            candidate.kind === "board" &&
            move.kind === "board" &&
            isSameTsumeShogiSquare(candidate.from, move.from) &&
            !isTsumeShogiDefenderInCheck(
              applyTsumeShogiMove(position, candidate),
            ),
        )
        .map((candidate) => candidate.to);

      expect(accepted).toEqual([move.to]);
      expect(new Set(violatedSquares.map(formatSquare))).toEqual(
        new Set(nonCheckSquares.map(formatSquare)),
      );
    },
  );

  test("ルールのどれもが、1つ以上の手順で示されること", () => {
    const introduced = steps.flatMap((step) =>
      step.introducedRuleId ? [step.introducedRuleId] : [],
    );

    expect(introduced).toEqual(tsumeShogiTutorial.rules.map(({ id }) => id));
  });

  describe("手順を終えた盤面の場合", () => {
    const session = released.boardState;
    const checks = listTsumeShogiAttackerChecks(session.puzzleState);
    const matingChecks = checks.filter((check) =>
      isTsumeShogiMateWithin(
        applyTsumeShogiMove(session.puzzleState, check),
        0,
      ),
    );

    test("詰ませる王手が、逃げられた王手と同じ升へ金を下げる手ただ1つであること", () => {
      const mating = matingChecks.map(formatTsumeShogiMoveUsi);

      expect(mating).toEqual([formatTsumeShogiMoveUsi(matingMove)]);
    });

    test("詰まない王手もあり、指すと手詰まりになるので、待ったを手を引く間に教えていること", () => {
      const undoTaught = steps.some((step) => step.target.type === "undo");

      expect(checks.length).toBeGreaterThan(matingChecks.length);
      expect(undoTaught).toBe(true);
    });
  });

  describe("手を離した後にどう進めても", () => {
    const explored = exploreFreePlay(released.boardState);

    test("届くどの盤面からも、王手と待ったで詰みへたどり着けること", () => {
      const solving = new Set(
        [...explored].flatMap(([key, { session }]) =>
          session.status === "cleared" ? [key] : [],
        ),
      );
      for (let grew = true; grew; ) {
        grew = false;
        for (const [key, { nextKeys }] of explored) {
          if (!solving.has(key) && nextKeys.some((next) => solving.has(next))) {
            solving.add(key);
            grew = true;
          }
        }
      }
      const stuck = [...explored.keys()].filter((key) => !solving.has(key));

      expect(solving.size).toBeGreaterThan(0);
      expect(stuck).toEqual([]);
    });

    test("手が止まったときの手がかりが、詰みへ向かう王手か、逃げられた後の待ったであること", () => {
      const wrongHints = [...explored.values()].flatMap(({ session }) => {
        const hint = findTsumeShogiTutorialHint(session);
        const phase = getTsumeShogiSessionPhase(session);
        if (session.status === "cleared") {
          return hint === null ? [] : [session];
        }
        if (phase === "refuted" || isTsumeShogiSessionOnWrongLine(session)) {
          return hint?.type === "undo" ? [] : [session];
        }
        if (hint?.type !== "move") {
          return [session];
        }
        const remaining = problem.plies - session.turns.length * 2;
        const mates = isTsumeShogiMateWithin(
          applyTsumeShogiMove(session.puzzleState, hint.move),
          remaining - 1,
        );
        return mates ? [] : [session];
      });

      expect(wrongHints).toEqual([]);
    });
  });
});

describe("performTutorialAction", () => {
  const firstMove = getStepMove(steps[0]!);
  const handSelected = perform(started, {
    type: "hand",
    pieceType: "gold",
  });

  test("手を引いている間は、印の持駒を選び、印の升へ打つと、玉方が応じてから次の手順へ進むこと", () => {
    const played = perform(handSelected, {
      type: "square",
      square: firstMove.to,
    });
    const replied = perform(played, { type: "defender-reply" });

    expect(handSelected.boardState.selection).toEqual({
      type: "hand",
      pieceType: "gold",
    });
    expect(played.stepIndex).toBe(0);
    expect(played.boardState.defenderReplyPending).toBe(true);
    expect(replied.stepIndex).toBe(1);
  });

  test("手を引いている間は、印の無い駒を押しても盤面を変えないこと", () => {
    const tapped = perform(started, {
      type: "square",
      square: { file: 2, rank: 6 },
    });

    expect(tapped).toBe(started);
  });

  test("王手を伝える前は、王手にならない升に打とうとしても、ルールに合わない手にしないこと", () => {
    const tapped = perform(handSelected, {
      type: "square",
      square: { file: 5, rank: 5 },
    });

    expect(tapped).toBe(handSelected);
  });

  describe("王手を伝えた手順の場合", () => {
    const checkStep = playSteps(1);
    const secondMove = getStepMove(steps[1]!);
    const selected = perform(checkStep, {
      type: "square",
      square: secondMove.kind === "board" ? secondMove.from : secondMove.to,
    });

    test("印の駒を王手にならない升へ動かそうとすると、本番と同じく着手させず、ルールに合わない手として応えること", () => {
      const rejected = perform(selected, {
        type: "square",
        square: { file: 3, rank: 3 },
      });
      const message = getTutorialMessage(tsumeShogiTutorial, rejected, {
        entry: "home",
        violationSettled: true,
      });

      expect(rejected.violated).toBe(true);
      expect(rejected.boardState.rejection?.reason).toBe("not-check");
      expect(rejected.boardState.turns).toEqual(checkStep.boardState.turns);
      expect(message).toEqual({
        headline: "王手にならない手は指せません",
        detail: null,
      });
    });

    test("印の無い升への王手は指させないこと", () => {
      const tapped = perform(selected, {
        type: "square",
        square: { file: 1, rank: 3 },
      });

      expect(tapped).toBe(selected);
    });
  });

  test("手順を進めるたびに、示したルールを手に入れること", () => {
    const earned = released.earnedRuleIds;

    expect(earned).toEqual(["drop", "check", "escape"]);
  });

  describe("手を離した後の場合", () => {
    const situation = getTutorialSituation(tsumeShogiTutorial, released);
    const escaped = perform(selectAndPlay(released, escapingCheck), {
      type: "defender-reply",
    });
    const solved = selectAndPlay(released, matingMove);

    test("手順を終えて、手を離していること", () => {
      const message = getTutorialMessage(tsumeShogiTutorial, released, {
        entry: "home",
        violationSettled: true,
      });

      expect(situation.step).toBeNull();
      expect(message).toBe(tsumeShogiTutorial.freePlay);
    });

    test("逃げ道のある王手を指すと、本番と同じく玉方が逃れ、待ったへ向かわせる一言を出すこと", () => {
      const message = getTutorialMessage(tsumeShogiTutorial, escaped, {
        entry: "home",
        violationSettled: true,
      });

      expect(escaped.violated).toBe(true);
      expect(getTsumeShogiSessionPhase(escaped.boardState)).toBe("refuted");
      expect(message).toEqual({
        headline: "逃げ道が残っていました",
        detail: "待ったを押すと、その王手の前に戻せます",
      });
    });

    test("駒を玉に取られる王手を指すと、守られていない駒は取られることを伝えること", () => {
      const captured = perform(
        selectAndPlay(released, {
          kind: "board",
          from: { file: 2, rank: 4 },
          to: { file: 1, rank: 4 },
          promote: false,
        }),
        { type: "defender-reply" },
      );
      const message = getTutorialMessage(tsumeShogiTutorial, captured, {
        entry: "home",
        violationSettled: true,
      });

      expect(message).toEqual({
        headline: "守られていない駒を\n玉に取られました",
        detail: "待ったを押すと、その王手の前に戻せます",
      });
    });

    test("待ったを押すと、違反の一言を下げて手を離した後の一言に戻すこと", () => {
      const undone = perform(escaped, { type: "undo" });
      const message = getTutorialMessage(tsumeShogiTutorial, undone, {
        entry: "home",
        violationSettled: true,
      });

      expect(undone.violated).toBe(false);
      expect(message).toBe(tsumeShogiTutorial.freePlay);
    });

    test("逃げ道をふさぐ王手を指すと、詰んで解き終えること", () => {
      const phase = solved.phase;

      expect(phase).toBe("solved");
    });
  });
});

describe("getTsumeShogiTutorialMark", () => {
  const firstTarget = steps[0]!.target;
  const firstMove = getStepMove(steps[0]!);
  const handSelected = perform(started, {
    type: "hand",
    pieceType: "gold",
  });

  const cases = [
    ["持駒を選ぶ前は、持駒", started, { type: "hand", pieceType: "gold" }],
    [
      "持駒を選んだ後は、打つ升",
      handSelected,
      { type: "square", square: firstMove.to },
    ],
  ] as const;

  test.each(cases)("%sに印を付けること", (_, progress, expected) => {
    const mark = getTsumeShogiTutorialMark(firstTarget, progress.boardState);

    expect(mark).toEqual(expected);
  });

  test("玉方の応手を待つ間は、印を付けないこと", () => {
    const played = perform(handSelected, {
      type: "square",
      square: firstMove.to,
    });

    const mark = getTsumeShogiTutorialMark(firstTarget, played.boardState);

    expect(mark).toBeNull();
  });
});

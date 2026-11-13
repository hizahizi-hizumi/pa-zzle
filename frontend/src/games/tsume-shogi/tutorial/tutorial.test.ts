import {
  findTsumeShogiRefutation,
  isTsumeShogiMateWithin,
} from "@/games/tsume-shogi/puzzle/mate-search";
import {
  applyTsumeShogiMove,
  formatTsumeShogiMoveUsi,
  isTsumeShogiCheckmate,
  listTsumeShogiAttackerChecks,
  listTsumeShogiLegalMoves,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  formatTsumeShogiPosition,
  getTsumeShogiHand,
  getTsumeShogiPieceAt,
  isSameTsumeShogiSquare,
  type TsumeShogiPosition,
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
  getTsumeShogiTutorialProgressRatio,
  TSUME_SHOGI_TUTORIAL_PROGRESS_STEP_COUNT,
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

const {
  problem,
  capturedCheck,
  defenderRookSquare,
  matingDrop,
  playMove,
  RELEASED_TURN_COUNT,
} = _private;
const { steps } = tsumeShogiTutorial;

type Progress = TutorialProgress<
  TsumeShogiTutorialRuleId,
  TsumeShogiTutorialBoardState
>;

const usi = formatTsumeShogiMoveUsi;

function perform(progress: Progress, action: TsumeShogiTutorialAction) {
  return performTutorialAction(tsumeShogiTutorial, progress, action);
}

/** 駒（持駒）を選び、行き先の升を押す。成・不成を選ぶ所では手のとおりに選ぶ。 */
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

function getStepMove(step: TsumeShogiTutorialStep): TsumeShogiMove {
  if (step.target.type === "undo") {
    throw new Error("攻方の手の手順ではありません");
  }
  return step.target.move;
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

function getStepIndex(predicate: (step: TsumeShogiTutorialStep) => boolean) {
  const index = steps.findIndex(predicate);
  if (index < 0) {
    throw new Error("手順がありません");
  }
  return index;
}

const checkStepIndex = getStepIndex(
  (step) => step.introducedRuleId === "check",
);
const captureStepIndex = getStepIndex(
  (step) => step.introducedRuleId === "capture",
);
const handStepIndex = getStepIndex((step) => step.introducedRuleId === "hand");

/** 駒（持駒）から指せる手のうち、行き先の升ごとの手。成・不成は同じ行き先にまとめる。 */
function groupBySource(
  moves: readonly TsumeShogiMove[],
  source: TsumeShogiMove,
): Map<string, TsumeShogiMove[]> {
  const groups = new Map<string, TsumeShogiMove[]>();
  for (const move of moves) {
    const sameSource =
      source.kind === "drop"
        ? move.kind === "drop" && move.pieceType === source.pieceType
        : move.kind === "board" &&
          isSameTsumeShogiSquare(move.from, source.from);
    if (!sameSource) {
      continue;
    }
    const key = `${move.to.file}-${move.to.rank}`;
    groups.set(key, [...(groups.get(key) ?? []), move]);
  }
  return groups;
}

/** 王手の後、玉方が王手した駒を取って逃れるか。 */
function isRefutedByCapture(
  position: TsumeShogiPosition,
  check: TsumeShogiMove,
  remainingPlies: number,
): boolean {
  const after = applyTsumeShogiMove(position, check);
  const refutation = findTsumeShogiRefutation(after, remainingPlies - 1);
  return refutation !== null && isSameTsumeShogiSquare(refutation.to, check.to);
}

/** 作意の攻方の手番ごとの、指す前の局面と残りの手数。 */
const attackerTurns = [0, 2, 4, 6].map((index) => ({
  position: problem.mainLine
    .slice(0, index)
    .reduce(applyTsumeShogiMove, problem.initialPosition),
  remainingPlies: problem.plies - index,
}));

function toStateKey(session: TsumeShogiSession): string {
  return [
    formatTsumeShogiPosition(session.puzzleState),
    getTsumeShogiSessionPhase(session),
    session.turns.map((turn) => turn.line).join(","),
  ].join(" ");
}

function exploreFreePlay(
  start: Progress,
): Map<string, { progress: Progress; nextKeys: string[] }> {
  const explored = new Map<
    string,
    { progress: Progress; nextKeys: string[] }
  >();
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const progress = queue[index] as Progress;
    const session = progress.boardState;
    const key = toStateKey(session);
    if (explored.has(key)) {
      continue;
    }
    const nexts: Progress[] = [];
    if (session.status !== "cleared") {
      const undone = perform(progress, { type: "undo" });
      if (undone !== progress) {
        nexts.push(undone);
      }
      // 王手にならない手と指せない手は盤面を変えないので含めない。
      if (getTsumeShogiSessionPhase(session) === "attacker") {
        for (const check of listTsumeShogiAttackerChecks(session.puzzleState)) {
          nexts.push(
            perform(
              { ...progress, boardState: playMove(session, check) },
              { type: "defender-reply" },
            ),
          );
        }
      }
    }
    explored.set(key, {
      progress,
      nextKeys: nexts.map((next) => toStateKey(next.boardState)),
    });
    queue.push(...nexts);
  }
  return explored;
}

describe("盤面", () => {
  test("5手では詰まず、7手で詰むこと", () => {
    const within5 = isTsumeShogiMateWithin(problem.initialPosition, 5);
    const within7 = isTsumeShogiMateWithin(problem.initialPosition, 7);

    expect(within5).toBe(false);
    expect(within7).toBe(true);
  });

  test("作意の玉方の応手が、どれも残りの手数を最も長くする応手であること", () => {
    const shortened = [1, 3, 5].filter((index) => {
      const position = problem.mainLine
        .slice(0, index + 1)
        .reduce(applyTsumeShogiMove, problem.initialPosition);
      const remaining = problem.plies - index - 1;
      return (
        !isTsumeShogiMateWithin(position, remaining) ||
        isTsumeShogiMateWithin(position, remaining - 2)
      );
    });

    expect(shortened).toEqual([]);
  });

  test("ゴールの盤面が、作意を指し終えて玉が詰んだ盤面であること", () => {
    const goal = tsumeShogiTutorial.goal();
    const finalPosition = problem.mainLine.reduce(
      applyTsumeShogiMove,
      problem.initialPosition,
    );

    expect(formatTsumeShogiPosition(goal.puzzleState)).toBe(
      formatTsumeShogiPosition(finalPosition),
    );
    expect(goal.status).toBe("cleared");
  });

  test("始めの攻方の持駒が、最初の手順で打つ飛車だけであること", () => {
    const hand = getTsumeShogiHand(problem.initialPosition, "attacker");

    expect(hand).toMatchObject({ rook: 1, gold: 0, silver: 0 });
  });
});

describe("手順", () => {
  test("ルールのどれもが、この順に1つずつ手順で伝えられること", () => {
    const introduced = steps.flatMap((step) =>
      step.introducedRuleId ? [step.introducedRuleId] : [],
    );

    expect(introduced).toEqual(tsumeShogiTutorial.rules.map(({ id }) => id));
  });

  test("最初の手順で操作を教え、作意の初手を駒と升の両方に印を付けて指させること", () => {
    const [first] = steps;

    expect(first?.introducedRuleId).toBeNull();
    expect(first?.target).toEqual({ type: "move", move: problem.mainLine[0] });
    expect(first?.keySquares).toEqual([]);
  });

  test("操作を教える手で動かした駒が、ゴールの盤面に残っていること", () => {
    const move = getStepMove(steps[0] as TsumeShogiTutorialStep);
    const goal = tsumeShogiTutorial.goal().puzzleState;

    expect(getTsumeShogiPieceAt(goal, move.to)).toEqual({
      side: "attacker",
      type: "rook",
    });
  });

  test("印の手を手順どおりに指す間は、守らせるルールに当たる手（誤王手と着手させない手）が1つも無いこと", () => {
    const progresses = steps.map((_, index) => playSteps(index + 1));
    const violated = progresses.flatMap((progress, index) =>
      progress.violated ||
      (steps[index]?.target.type !== "move" &&
        isTsumeShogiSessionOnWrongLine(progress.boardState))
        ? [index]
        : [],
    );

    expect(violated).toEqual([]);
  });

  test("攻方の手を指させる手順は、作意の手か、王手した駒を取られることを見せる王手であること", () => {
    const moves = steps.flatMap((step) =>
      step.target.type === "undo" ? [] : [usi(step.target.move)],
    );

    expect(moves).toEqual(
      [
        problem.mainLine[0],
        problem.mainLine[2],
        capturedCheck,
        problem.mainLine[4],
      ].map((move) => usi(move as TsumeShogiMove)),
    );
  });

  describe("王手を伝える手順の場合", () => {
    const step = steps[checkStepIndex] as TsumeShogiTutorialStep;
    const { position } = attackerTurns[1] as (typeof attackerTurns)[number];
    const move = getStepMove(step);
    const destinations = groupBySource(
      listTsumeShogiLegalMoves(position),
      move,
    );
    const checkDestinations = groupBySource(
      listTsumeShogiAttackerChecks(position),
      move,
    );

    test("駒にだけ印を付け、行き先を自分で選ばせること", () => {
      const target = step.target.type;

      expect(target).toBe("choice");
    });

    test("印の駒の行き先が2つ以上あり、王手になる行き先は作意の升ただ1つであること", () => {
      const checkKeys = [...checkDestinations.keys()];

      expect(destinations.size).toBeGreaterThanOrEqual(2);
      expect(checkKeys).toEqual([`${move.to.file}-${move.to.rank}`]);
    });

    test("王手になる行き先へは、成っても成らなくても残りの手数で詰むこと", () => {
      const checks = checkDestinations.get(`${move.to.file}-${move.to.rank}`);
      const mates = (checks ?? []).map((check) =>
        isTsumeShogiMateWithin(applyTsumeShogiMove(position, check), 4),
      );

      expect(mates.length).toBeGreaterThan(0);
      expect(mates.every(Boolean)).toBe(true);
    });
  });

  describe("王手した駒を取られて詰まなくなることを伝える手順の場合", () => {
    const step = steps[captureStepIndex] as TsumeShogiTutorialStep;
    const turn = attackerTurns[2] as (typeof attackerTurns)[number];

    test("印の王手を指すと、王手した駒を取られて、この手数では詰まなくなること", () => {
      const refutedByCapture = isRefutedByCapture(
        turn.position,
        getStepMove(step),
        turn.remainingPlies,
      );

      expect(refutedByCapture).toBe(true);
    });

    test("決め手として見せる升に、王手した駒を取る玉方の駒があること", () => {
      const piece = getTsumeShogiPieceAt(turn.position, defenderRookSquare);

      expect(step.keySquares).toEqual([defenderRookSquare]);
      expect(piece?.side).toBe("defender");
    });

    test("次の手順で待ったを押すと、取られた王手の前の盤面へ戻ること", () => {
      const beforeUndo = playSteps(captureStepIndex + 1);
      const undone = playSteps(captureStepIndex + 2);

      expect(steps[captureStepIndex + 1]?.target.type).toBe("undo");
      expect(isTsumeShogiSessionOnWrongLine(beforeUndo.boardState)).toBe(true);
      expect(formatTsumeShogiPosition(undone.boardState.puzzleState)).toBe(
        formatTsumeShogiPosition(turn.position),
      );
    });
  });

  describe("持駒を伝え、読ませる手順の場合", () => {
    const step = steps[handStepIndex] as TsumeShogiTutorialStep;
    const turn = attackerTurns[2] as (typeof attackerTurns)[number];
    const move = getStepMove(step);
    const checks = [
      ...groupBySource(
        listTsumeShogiAttackerChecks(turn.position),
        move,
      ).values(),
    ].flat();

    test("駒にだけ印を付け、王手になる行き先が2つ以上あること", () => {
      const target = step.target.type;

      expect(target).toBe("choice");
      expect(checks.length).toBeGreaterThanOrEqual(2);
    });

    test("残りの手数で詰む王手は、相手の飛車を取る作意の手だけであること", () => {
      const mating = checks
        .filter((check) =>
          isTsumeShogiMateWithin(
            applyTsumeShogiMove(turn.position, check),
            turn.remainingPlies - 1,
          ),
        )
        .map(usi);
      const captured = getTsumeShogiPieceAt(turn.position, move.to);

      expect(mating).toEqual([usi(move)]);
      expect(captured?.type).toBe("rook");
    });

    test("ほかの王手は、どれも王手した駒を取られて崩れること", () => {
      const notCaptured = checks
        .filter((check) => usi(check) !== usi(move))
        .filter(
          (check) =>
            !isRefutedByCapture(turn.position, check, turn.remainingPlies),
        )
        .map(usi);

      expect(notCaptured).toEqual([]);
    });
  });

  test("決め手の無い手順（操作と待った）だけ、決め手の升を持たないこと", () => {
    const withoutKeys = steps.flatMap((step, index) =>
      step.keySquares.length === 0 ? [index] : [],
    );
    const operations = steps.flatMap((step, index) =>
      step.introducedRuleId === null ? [index] : [],
    );

    expect(withoutKeys).toEqual(operations);
  });

  test("進み具合の段の数が、手順の数と手を離した後の1段であること", () => {
    const ratio = getTsumeShogiTutorialProgressRatio(steps.length);

    expect(TSUME_SHOGI_TUTORIAL_PROGRESS_STEP_COUNT).toBe(steps.length + 1);
    expect(ratio).toBeLessThan(1);
  });
});

describe("手を離した後", () => {
  const turn = attackerTurns[3] as (typeof attackerTurns)[number];
  const checks = listTsumeShogiAttackerChecks(turn.position);

  test("手順を終えて手を離し、取った飛車を持っていること", () => {
    const situation = getTutorialSituation(tsumeShogiTutorial, released);
    const hand = getTsumeShogiHand(released.boardState.puzzleState, "attacker");

    expect(situation.step).toBeNull();
    expect(released.boardState.turns).toHaveLength(RELEASED_TURN_COUNT);
    expect(hand.rook).toBe(1);
  });

  test("王手が2つ以上あり、詰ませる王手は取った飛車を打つ手ただ1つであること", () => {
    const mating = checks
      .filter((check) =>
        isTsumeShogiCheckmate(applyTsumeShogiMove(turn.position, check)),
      )
      .map(usi);

    expect(checks.length).toBeGreaterThanOrEqual(2);
    expect(mating).toEqual([usi(matingDrop)]);
  });

  test("ほかの王手は、どれも玉方がすぐに逃れること", () => {
    const unrefuted = checks
      .filter((check) => usi(check) !== usi(matingDrop))
      .filter(
        (check) =>
          findTsumeShogiRefutation(
            applyTsumeShogiMove(turn.position, check),
            0,
          ) === null,
      )
      .map(usi);

    expect(unrefuted).toEqual([]);
  });

  describe("どう進めても", () => {
    const explored = exploreFreePlay(released);

    test("届くどの盤面からも、王手と待ったで詰みへたどり着けること", () => {
      const solving = new Set(
        [...explored].flatMap(([key, { progress }]) =>
          progress.boardState.status === "cleared" ? [key] : [],
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

    test("待ったで、手を離す前の盤面へは戻らないこと", () => {
      const rewound = [...explored.values()].filter(
        ({ progress }) =>
          progress.boardState.turns.length < RELEASED_TURN_COUNT,
      );

      expect(rewound).toEqual([]);
    });

    test("「ヒント」の手がかりが、詰ませる王手か、逃れられた後の待ったであること", () => {
      const wrongHints = [...explored.values()].flatMap(({ progress }) => {
        const session = progress.boardState;
        const hint = findTsumeShogiTutorialHint(session);
        if (session.status === "cleared") {
          return hint === null ? [] : [toStateKey(session)];
        }
        if (isTsumeShogiSessionOnWrongLine(session)) {
          return hint?.type === "undo" ? [] : [toStateKey(session)];
        }
        if (hint?.type !== "move") {
          return [toStateKey(session)];
        }
        return isTsumeShogiCheckmate(
          applyTsumeShogiMove(session.puzzleState, hint.move),
        )
          ? []
          : [toStateKey(session)];
      });

      expect(wrongHints).toEqual([]);
    });
  });
});

describe("performTutorialAction", () => {
  const firstMove = getStepMove(steps[0] as TsumeShogiTutorialStep);

  test("手を引いている間は、印の持駒を選び、印の升へ打つと、玉方が応じてから次の手順へ進むこと", () => {
    const played = selectAndPlay(started, firstMove);
    const replied = perform(played, { type: "defender-reply" });

    expect(played.stepIndex).toBe(0);
    expect(replied.stepIndex).toBe(1);
  });

  test("手を引いている間は、印の無い駒を押しても盤面を変えないこと", () => {
    const tapped = perform(started, {
      type: "square",
      square: { file: 7, rank: 3 },
    });

    expect(tapped).toBe(started);
  });

  describe("王手を伝える前の場合", () => {
    const handSelected = perform(started, { type: "hand", pieceType: "rook" });

    test("印の無い升へ打とうとしても、盤面を変えず、ルールに合わない手にもしないこと", () => {
      const tapped = perform(handSelected, {
        type: "square",
        square: { file: 1, rank: 9 },
      });

      expect(tapped).toBe(handSelected);
    });
  });

  describe("王手を伝えた手順の場合", () => {
    const atCheckStep = playSteps(checkStepIndex);
    const move = getStepMove(steps[checkStepIndex] as TsumeShogiTutorialStep);
    const selected = perform(atCheckStep, {
      type: "square",
      square: move.kind === "board" ? move.from : move.to,
    });
    const notCheckSquare: TsumeShogiSquare = { file: 5, rank: 2 };

    test("印の駒を王手にならない升へ動かそうとすると、本番と同じく着手させず、ルールに合わない手として応えること", () => {
      const tapped = perform(selected, {
        type: "square",
        square: notCheckSquare,
      });
      const message = getTutorialMessage(tsumeShogiTutorial, tapped, {
        entry: "home",
        violationSettled: true,
      });

      expect(tapped.violated).toBe(true);
      expect(tapped.boardState.rejection?.reason).toBe("not-check");
      expect(tapped.boardState.turns).toEqual(atCheckStep.boardState.turns);
      expect(message.headline).toBe("王手になっていません");
    });

    test.each([true, false])(
      "王手になる升では成・不成を選ばせ、どちらを選んでも次の手順へ進むこと: 成る %s",
      (promote) => {
        const tapped = perform(selected, { type: "square", square: move.to });
        const chosen = perform(tapped, { type: "promotion", promote });
        const replied = perform(chosen, { type: "defender-reply" });

        expect(tapped.boardState.promotionChoice).not.toBeNull();
        expect(replied.stepIndex).toBe(checkStepIndex + 1);
      },
    );
  });

  describe("持駒を伝え、読ませる手順でほかの王手を指した場合", () => {
    const atHandStep = playSteps(handStepIndex);
    const wrongCheck = parseWrong();
    const refuted = perform(selectAndPlay(atHandStep, wrongCheck), {
      type: "defender-reply",
    });

    function parseWrong(): TsumeShogiMove {
      const move = getStepMove(steps[handStepIndex] as TsumeShogiTutorialStep);
      const turn = attackerTurns[2] as (typeof attackerTurns)[number];
      const other = listTsumeShogiAttackerChecks(turn.position).find(
        (check) =>
          check.kind === "board" &&
          move.kind === "board" &&
          isSameTsumeShogiSquare(check.from, move.from) &&
          usi(check) !== usi(move),
      );
      if (!other) {
        throw new Error("ほかの王手がありません");
      }
      return other;
    }

    test("本番と同じく玉方が逃れ、駒を取られたわけを伝え、待ったに印を付けること", () => {
      const message = getTutorialMessage(tsumeShogiTutorial, refuted, {
        entry: "home",
        violationSettled: true,
      });
      const step = steps[handStepIndex] as TsumeShogiTutorialStep;
      const mark = getTsumeShogiTutorialMark(step.target, refuted.boardState);

      expect(refuted.stepIndex).toBe(handStepIndex);
      expect(refuted.violated).toBe(true);
      expect(message.headline).toBe("王手した駒を取られて\n詰まなくなりました");
      expect(mark).toEqual({ type: "undo" });
    });

    test("待ったを押すと、同じ手順の始めの盤面へ戻ること", () => {
      const undone = perform(refuted, { type: "undo" });

      expect(undone.stepIndex).toBe(handStepIndex);
      expect(undone.violated).toBe(false);
      expect(formatTsumeShogiPosition(undone.boardState.puzzleState)).toBe(
        formatTsumeShogiPosition(atHandStep.boardState.puzzleState),
      );
    });
  });

  describe("手を離した後に逃れられる王手を指した場合", () => {
    const wrongDrop: TsumeShogiMove = {
      kind: "drop",
      pieceType: "rook",
      to: { file: 7, rank: 4 },
    };
    const refuted = perform(selectAndPlay(released, wrongDrop), {
      type: "defender-reply",
    });

    test("本番と同じく玉方が逃れ、待ったで戻すことを伝えること", () => {
      const message = getTutorialMessage(tsumeShogiTutorial, refuted, {
        entry: "home",
        violationSettled: true,
      });

      expect(refuted.violated).toBe(true);
      expect(message.detail).toBe("待ったボタンを押して王手の前に戻します");
    });

    test("待ったを押すと、違反の一言を下げて手を離した後の一言に戻すこと", () => {
      const undone = perform(refuted, { type: "undo" });
      const message = getTutorialMessage(tsumeShogiTutorial, undone, {
        entry: "home",
        violationSettled: true,
      });

      expect(message).toEqual(tsumeShogiTutorial.freePlay);
    });
  });

  test("手を離した後に取った飛車を打って詰ませると、解き終えること", () => {
    const solved = selectAndPlay(released, matingDrop);

    expect(solved.phase).toBe("solved");
  });
});

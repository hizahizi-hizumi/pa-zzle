import type { HitofudePuzzleTraceStep } from "@/games/hitofude-puzzle/puzzle/transitions";
import {
  beginHitofudePuzzleSessionStroke,
  createHitofudePuzzleSession,
  endHitofudePuzzleSessionStroke,
  type HitofudePuzzleSession,
  traceHitofudePuzzleSessionStroke,
  undoHitofudePuzzleSession,
} from "@/games/hitofude-puzzle/session/session";
import type {
  HitofudePuzzleHowToPlayBacktrackFlow,
  HitofudePuzzleHowToPlayFlowStep,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/figure-boards";

/**
 * 流れのコマ1つ。そのコマの道と、そのコマへ進めた操作で押したマス（`pressedCell`）と、その操作で増えた引き直しの回数（`addedBacktracks`）。
 * 押す手（押して離す・押したままなぞる）は、どれも押したマスを `pressedCell` で示す。なぞるだけの手と待ったは押したマスを持たない。
 * 最初のコマは操作の前の姿なので、押したマスを持たず、増えた回数は 0。
 */
export type HitofudePuzzleBacktrackFrame = {
  path: readonly number[];
  pressedCell: number | null;
  addedBacktracks: number;
};

/** 流れを本番の session で打ったコマと、打ち終えたときの引き直しの回数。 */
export type HitofudePuzzleBacktrackFigure = {
  frames: readonly HitofudePuzzleBacktrackFrame[];
  backtrackCount: number;
};

/** 流れは時間を使わないので、どの操作も同じ時刻に打つ。 */
const OPERATED_AT = 0;

/** 指が `from` のマスから並べたマスを順に移る、なぞりの刻み。 */
function listTraceSteps(
  from: number,
  cells: readonly number[],
): HitofudePuzzleTraceStep[] {
  return cells.map((to, index) => ({
    from: index === 0 ? from : cells[index - 1]!,
    to,
    horizontalFirst: true,
  }));
}

/**
 * `cell` を押し、押したまま並べたマスをなぞって離す。本番の盤面のなぞりと同じ順に session へ渡す。
 * 遊び方の図と例で、道を引く・押す・なぞる手を session で打つときは、どれもこれを使う。経過時間は使わない。
 */
export function strokeHitofudePuzzleSession(
  session: HitofudePuzzleSession,
  cell: number,
  cells: readonly number[],
): HitofudePuzzleSession {
  let current = beginHitofudePuzzleSessionStroke(
    session,
    cell,
    OPERATED_AT,
  ).session;
  for (const step of listTraceSteps(cell, cells)) {
    current = traceHitofudePuzzleSessionStroke(
      current,
      step,
      OPERATED_AT,
    ).session;
  }
  return endHitofudePuzzleSessionStroke(current);
}

function getHead(session: HitofudePuzzleSession): number {
  return session.puzzleState.path.at(-1)!;
}

/** 流れの操作1つを打つ。 */
function playStep(
  session: HitofudePuzzleSession,
  step: HitofudePuzzleHowToPlayFlowStep,
): HitofudePuzzleSession {
  switch (step.kind) {
    case "press":
      return strokeHitofudePuzzleSession(session, step.cell, []);
    case "trace":
      return strokeHitofudePuzzleSession(session, getHead(session), step.cells);
    case "pressAndTrace":
      return strokeHitofudePuzzleSession(session, step.cell, step.cells);
    case "undo":
      return undoHitofudePuzzleSession(session);
  }
}

/**
 * 流れを本番の session で打ち、コマを作る。始まりの道は、始点から1回のなぞりで引いたものとする。
 * 引き直しの回数は、始まりの道を引いた後から数えた値（始まりの道を引いても数えない）。コマごとに、その操作で増えた回数も持つ。
 */
export function playHitofudePuzzleBacktrackFlow({
  board,
  start,
  steps,
}: HitofudePuzzleHowToPlayBacktrackFlow): HitofudePuzzleBacktrackFigure {
  let session = strokeHitofudePuzzleSession(
    createHitofudePuzzleSession(board, OPERATED_AT),
    board.start,
    start.slice(1),
  );
  const frames: HitofudePuzzleBacktrackFrame[] = [
    { path: session.puzzleState.path, pressedCell: null, addedBacktracks: 0 },
  ];
  for (const step of steps) {
    const before = session.backtrackCount;
    session = playStep(session, step);
    frames.push({
      path: session.puzzleState.path,
      pressedCell:
        step.kind === "press" || step.kind === "pressAndTrace"
          ? step.cell
          : null,
      addedBacktracks: session.backtrackCount - before,
    });
  }
  return { frames, backtrackCount: session.backtrackCount };
}

export type Session = {
  moves: number;
  mistakes: number;
};

export function finishSession(session: Session) {
  return {
    moveCount: session.moves,
    mistakeCount: session.mistakes,
  };
}

export type Session = {
  moves: number;
  difficulty: "easy" | "normal" | "hard";
};

export function finishSession(session: Session) {
  const difficulty =
    session.moves < 20 ? "easy" : session.moves < 40 ? "normal" : "hard";

  return {
    ...session,
    difficulty,
  };
}

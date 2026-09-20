export const INTERNAL_DIAGNOSTIC_FORMAT_VERSION = 1;

export type InternalDiagnosticSnapshot<
  Game extends string,
  Difficulty extends string,
  ProblemIdentity,
> = {
  formatVersion: typeof INTERNAL_DIAGNOSTIC_FORMAT_VERSION;
  game: Game;
  difficulty: Difficulty;
  problemIdentity: ProblemIdentity;
  buildRevision: string | null;
};

export function serializeInternalDiagnosticSnapshot(
  snapshot: InternalDiagnosticSnapshot<string, string, unknown>,
): string {
  return JSON.stringify(snapshot, null, 2);
}

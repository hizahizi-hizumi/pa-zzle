import { isRecordObject } from "@/lib/type-guards";

export const INTERNAL_DIAGNOSTIC_FORMAT_VERSION = 1;

/** 内部診断でコピーする値の、全ゲームに共通する項目。ゲーム固有の項目はこの型に足す。 */
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

type AnyInternalDiagnosticSnapshot = InternalDiagnosticSnapshot<
  string,
  string,
  unknown
>;

type InternalDiagnosticSnapshotBase<
  Snapshot extends AnyInternalDiagnosticSnapshot,
> = InternalDiagnosticSnapshot<
  Snapshot["game"],
  Snapshot["difficulty"],
  Snapshot["problemIdentity"]
>;

export type InternalDiagnosticFormat<
  Snapshot extends AnyInternalDiagnosticSnapshot,
> = {
  game: Snapshot["game"];
  parseDifficulty: (value: string) => Snapshot["difficulty"] | undefined;
  isProblemIdentity: (value: unknown) => value is Snapshot["problemIdentity"];
  /**
   * 項目の形や、共通項目との整合（identity が難易度に合うかなど）が合わなければ `undefined` を返す。
   * 共通項目だけを持ち、整合を確かめることもないゲームでは省く。
   */
  readDetails?: (
    value: Record<string, unknown>,
    base: InternalDiagnosticSnapshotBase<Snapshot>,
  ) => Omit<Snapshot, keyof AnyInternalDiagnosticSnapshot> | undefined;
};

export function createInternalDiagnosticSnapshot<
  Snapshot extends AnyInternalDiagnosticSnapshot,
>(
  format: InternalDiagnosticFormat<Snapshot>,
  {
    difficulty,
    problemIdentity,
    buildRevision,
  }: {
    difficulty: Snapshot["difficulty"];
    problemIdentity: Snapshot["problemIdentity"];
    buildRevision: string | null;
  },
): InternalDiagnosticSnapshotBase<Snapshot> {
  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: format.game,
    difficulty,
    problemIdentity: structuredClone(problemIdentity),
    buildRevision,
  };
}

export function serializeInternalDiagnosticSnapshot(
  snapshot: AnyInternalDiagnosticSnapshot,
): string {
  return JSON.stringify(snapshot, null, 2);
}

export function parseInternalDiagnosticSnapshot<
  Snapshot extends AnyInternalDiagnosticSnapshot,
>(serialized: string, format: InternalDiagnosticFormat<Snapshot>): Snapshot {
  const value: unknown = JSON.parse(serialized);
  if (!isRecordObject(value)) {
    throw new TypeError(`${format.game} diagnostic snapshot must be an object`);
  }

  const difficulty =
    typeof value.difficulty === "string"
      ? format.parseDifficulty(value.difficulty)
      : undefined;
  const { problemIdentity, buildRevision } = value;
  if (
    value.formatVersion !== INTERNAL_DIAGNOSTIC_FORMAT_VERSION ||
    value.game !== format.game ||
    difficulty === undefined ||
    !format.isProblemIdentity(problemIdentity) ||
    !(typeof buildRevision === "string" || buildRevision === null)
  ) {
    throw new TypeError(`Invalid ${format.game} diagnostic snapshot`);
  }

  const base: InternalDiagnosticSnapshotBase<Snapshot> = {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: format.game,
    difficulty,
    problemIdentity,
    buildRevision,
  };
  if (!format.readDetails) {
    return base as Snapshot;
  }

  const details = format.readDetails(value, base);
  if (details === undefined) {
    throw new TypeError(`Invalid ${format.game} diagnostic snapshot`);
  }
  return { ...base, ...details } as Snapshot;
}

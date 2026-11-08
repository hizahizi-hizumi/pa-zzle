import type {
  CuratedStudyCandidate,
  CuratedStudyGameId,
} from "@/experiments/curated-study";
import { curatedStudyGames } from "@/experiments/curated-study";
import {
  listNanpurePoolEntries,
  type NanpureProblemPoolEntry,
  toNanpurePoolIdentity,
} from "@/games/nanpure/problem/problem-pool";
import {
  listParkingJamPoolEntries,
  type ParkingJamProblemPoolEntry,
  toParkingJamPoolIdentity,
} from "@/games/parking-jam/problem/problem-pool";
import { createProblemId } from "@/games/problem-id";

type Entry = {
  candidate: CuratedStudyCandidate;
  stratum: string;
  signature: number[];
};

const levels = ["3", "4", "5"] as const;

function stableHash(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

function clueSignature(encodedProblem: string): number[] {
  const hexadecimal = encodedProblem.slice(81);
  const bits = Array.from(hexadecimal).flatMap((digit) =>
    [3, 2, 1, 0].map((shift) => (parseInt(digit, 16) >> shift) & 1),
  );
  const counts = Array.from({ length: 27 }, () => 0);
  for (let index = 0; index < 81; index += 1) {
    if (bits[index] !== 1) continue;
    const row = Math.floor(index / 9);
    const column = index % 9;
    counts[row] = (counts[row] ?? 0) + 1;
    counts[9 + column] = (counts[9 + column] ?? 0) + 1;
    const box = 18 + Math.floor(row / 3) * 3 + Math.floor(column / 3);
    counts[box] = (counts[box] ?? 0) + 1;
  }
  return counts;
}

function nanpureEntry(
  entry: NanpureProblemPoolEntry,
  difficulty: "3" | "4" | "5",
): Entry {
  const identity = toNanpurePoolIdentity(entry);
  const signature = clueSignature(entry[2]);
  const clueCount = signature
    .slice(0, 9)
    .reduce((sum, value) => sum + value, 0);
  return {
    candidate: {
      difficulty,
      problemId: createProblemId(identity),
      seed: identity.seed,
    },
    stratum: `${difficulty}/${entry[0] ?? "none"}/${clueCount}`,
    signature,
  };
}

function parkingEntry(
  entry: ParkingJamProblemPoolEntry,
  difficulty: "3" | "4" | "5",
): Entry {
  const identity = toParkingJamPoolIdentity(entry);
  const c = identity.conditions;
  return {
    candidate: {
      difficulty,
      problemId: createProblemId(identity),
      seed: identity.seed,
    },
    stratum: `${difficulty}/${c.width}/${c.height}/${c.vehicleCount}/${c.fixedAreaCount}/${c.roadOpeningCount}`,
    signature: [
      c.roadOpeningSpan,
      c.blockingPlacementProbability * 4,
      c.fixedAreaLength,
    ],
  };
}

function entriesFor(gameId: CuratedStudyGameId): Entry[] {
  return levels.flatMap((difficulty) =>
    gameId === "nanpure"
      ? listNanpurePoolEntries(difficulty).map((entry) =>
          nanpureEntry(entry, difficulty),
        )
      : listParkingJamPoolEntries(difficulty).map((entry) =>
          parkingEntry(entry, difficulty),
        ),
  );
}

function signatureDistance(a: Entry, b: Entry): number {
  return a.signature.reduce(
    (sum, value, index) => sum + Math.abs(value - (b.signature[index] ?? 0)),
    0,
  );
}

/** 問題集の安価なメタデータだけで、同じ規模の候補4件から次の1問を決める。解法解析は呼ばない。 */
export function selectCuratedStudySequence(
  gameId: CuratedStudyGameId,
  episode: number,
  method: "random" | "diverse",
  unavailable: ReadonlySet<string> = new Set(),
): CuratedStudyCandidate[] | null {
  const all = entriesFor(gameId);
  const byId = new Map(all.map((entry) => [entry.candidate.problemId, entry]));
  const anchors = curatedStudyGames[gameId].sets.a;
  const control = curatedStudyGames[gameId].sets.b;
  const excluded = new Set([
    ...anchors.map((candidate) => candidate.problemId),
    ...control.map((candidate) => candidate.problemId),
    ...unavailable,
  ]);
  const chosen: Entry[] = [];
  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = byId.get(anchors[index]?.problemId ?? "");
    if (!anchor)
      throw new Error(
        "Selected study candidate is missing from the problem pool",
      );
    const choices = all
      .filter(
        (entry) =>
          entry.stratum === anchor.stratum &&
          !excluded.has(entry.candidate.problemId),
      )
      .sort(
        (a, b) =>
          stableHash(
            `668/${gameId}/${episode}/${index}/${a.candidate.problemId}`,
          ) -
          stableHash(
            `668/${gameId}/${episode}/${index}/${b.candidate.problemId}`,
          ),
      )
      .slice(0, 4);
    if (choices.length === 0) return null;
    const prior = chosen.find(
      (entry) => entry.candidate.difficulty === anchor.candidate.difficulty,
    );
    const best =
      method === "diverse" && prior
        ? [...choices].sort(
            (a, b) => signatureDistance(b, prior) - signatureDistance(a, prior),
          )[0]
        : choices[0];
    if (!best) return null;
    chosen.push(best);
    excluded.add(best.candidate.problemId);
  }
  return chosen.map(({ candidate }) => candidate);
}

/** 利用済み問題を除外して6問ずつ供給したときの枯渇と計算時間を実測するための入口。 */
export function simulateCuratedStudySupply(
  gameId: CuratedStudyGameId,
  method: "random" | "diverse",
  limit: number,
): {
  completedEpisodes: number;
  uniqueProblems: number;
  exhausted: boolean;
  averagePairDistance: number;
} {
  const seen = new Set<string>();
  const lookup = new Map(
    entriesFor(gameId).map((entry) => [entry.candidate.problemId, entry]),
  );
  let totalDescriptorDistance = 0;
  for (let episode = 0; episode < limit; episode += 1) {
    const candidates = selectCuratedStudySequence(
      gameId,
      episode,
      method,
      seen,
    );
    if (!candidates)
      return {
        completedEpisodes: episode,
        uniqueProblems: seen.size,
        exhausted: true,
        averagePairDistance: totalDescriptorDistance / (3 * episode),
      };
    for (let index = 0; index < 3; index += 1) {
      const first = lookup.get(candidates[index]?.problemId ?? "");
      const second = lookup.get(candidates[index + 3]?.problemId ?? "");
      if (!first || !second) throw new Error("Generated candidate is missing");
      totalDescriptorDistance += signatureDistance(first, second);
    }
    for (const candidate of candidates) seen.add(candidate.problemId);
  }
  return {
    completedEpisodes: limit,
    uniqueProblems: seen.size,
    exhausted: false,
    averagePairDistance: totalDescriptorDistance / (3 * limit),
  };
}

export type ContinuousStudyMethod = "random" | "diverse";

/** 同じ難易度・同じ規模の問題集から、1セッション分の連続プレイを再現する。 */
export function selectContinuousStudySequence(
  gameId: CuratedStudyGameId,
  difficulty: "3" | "4" | "5",
  method: ContinuousStudyMethod,
  episode: number,
): CuratedStudyCandidate[] | null {
  if (!Number.isSafeInteger(episode) || episode < 0 || episode > 99)
    return null;

  const groups = new Map<string, Entry[]>();
  for (const entry of entriesFor(gameId)) {
    if (entry.candidate.difficulty !== difficulty) continue;
    const group = groups.get(entry.stratum) ?? [];
    group.push(entry);
    groups.set(entry.stratum, group);
  }
  const pool = [...groups.entries()]
    .filter(([, entries]) => entries.length >= 10)
    .sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
    )[0]?.[1];
  if (!pool) return null;

  const chosen: Entry[] = [];
  const excluded = new Set<string>();
  for (let position = 0; position < 10; position += 1) {
    const choices = pool
      .filter(({ candidate }) => !excluded.has(candidate.problemId))
      .sort(
        (a, b) =>
          stableHash(
            `668/continuous/${gameId}/${difficulty}/${episode}/${position}/${a.candidate.problemId}`,
          ) -
          stableHash(
            `668/continuous/${gameId}/${difficulty}/${episode}/${position}/${b.candidate.problemId}`,
          ),
      )
      .slice(0, 4);
    if (choices.length === 0) return null;

    const previous = chosen.slice(-2);
    const next =
      method === "diverse" && previous.length > 0
        ? [...choices].sort((a, b) => {
            const distance = (entry: Entry) =>
              Math.min(
                ...previous.map((prior) => signatureDistance(entry, prior)),
              );
            return distance(b) - distance(a);
          })[0]
        : choices[0];
    if (!next) return null;
    chosen.push(next);
    excluded.add(next.candidate.problemId);
  }
  return chosen.map(({ candidate }) => candidate);
}

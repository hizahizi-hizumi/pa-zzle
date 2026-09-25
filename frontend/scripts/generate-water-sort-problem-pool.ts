import { writeFileSync } from "node:fs";
import { createProblemSeededRandom } from "@/games/problem-seed";
import {
  assessWaterSortDifficulty,
  type WaterSortDifficulty,
  waterSortDifficulties,
  waterSortDifficultyCriteria,
} from "@/games/water-sort/difficulty";
import {
  generateWaterSortProblem,
  WaterSortGenerationExhaustedError,
} from "@/games/water-sort/problem/generator";
import { analyzeWaterSortNaturalPlay } from "@/games/water-sort/problem/natural-play";
import { WATER_SORT_GENERATOR_VERSION } from "@/games/water-sort/problem/problem";
import type { WaterSortProblemPoolEntry } from "@/games/water-sort/problem/problem-pool";

const outputPath = new URL(
  "../src/games/water-sort/problem/problem-pool.json",
  import.meta.url,
);
const naturalPlayTrialCount = 60;
const maximumGenerationAttempts = 30;
const maximumExpandedStates = 100_000;

type Profile = { colorCount: number; emptyBottleCount: number };
type Candidate = { index: number; entry: WaterSortProblemPoolEntry | null };

function profileKey({ colorCount, emptyBottleCount }: Profile): string {
  return `${colorCount}-${emptyBottleCount}`;
}

function createCandidate(profile: Profile, index: number): Candidate {
  const seed = `ws${profileKey(profile)}-${index}`;
  try {
    const problem = generateWaterSortProblem({
      seed,
      ...profile,
      maximumAttempts: maximumGenerationAttempts,
      solverOptions: { maxExpandedStates: maximumExpandedStates },
    });
    const naturalPlay = analyzeWaterSortNaturalPlay(
      problem.problem.initialState,
      {
        trialCount: naturalPlayTrialCount,
        random: createProblemSeededRandom(`natural-play:${seed}`),
      },
    );

    return {
      index,
      entry: [
        seed,
        profile.colorCount,
        profile.emptyBottleCount,
        problem.identity.generationAttempt,
        problem.optimalMoveCount,
        Math.round(naturalPlay.stuckRate * 1000) / 1000,
      ],
    };
  } catch (error) {
    if (error instanceof WaterSortGenerationExhaustedError) {
      return { index, entry: null };
    }
    throw error;
  }
}

function runWorker([colorCount, emptyBottleCount, start, count]: number[]) {
  const profile = {
    colorCount: colorCount!,
    emptyBottleCount: emptyBottleCount!,
  };
  for (let index = start!; index < start! + count!; index += 1) {
    console.log(JSON.stringify(createCandidate(profile, index)));
  }
}

function readOption(name: string, fallback: number): number {
  const index = Bun.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(Bun.argv[index + 1]) : fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`--${name} must be a positive integer`);
  }
  return value;
}

function listProfiles(): Profile[] {
  const profiles = new Map<string, Profile>();
  for (const { id } of waterSortDifficulties) {
    for (const profile of waterSortDifficultyCriteria[id].generationProfiles) {
      profiles.set(profileKey(profile), profile);
    }
  }
  return [...profiles.values()];
}

function levelOf(entry: WaterSortProblemPoolEntry): WaterSortDifficulty | null {
  const [, colorCount, emptyBottleCount, , , stuckRate] = entry;
  return assessWaterSortDifficulty({
    conditions: { colorCount, emptyBottleCount },
    stuckRate,
  });
}

async function runBatch(
  profile: Profile,
  start: number,
  count: number,
): Promise<Candidate[]> {
  const worker = Bun.spawn(
    [
      process.execPath,
      Bun.fileURLToPath(import.meta.url),
      "--worker",
      String(profile.colorCount),
      String(profile.emptyBottleCount),
      String(start),
      String(count),
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const output = await new Response(worker.stdout).text();
  if ((await worker.exited) !== 0) {
    throw new Error(`Worker failed for profile ${profileKey(profile)}`);
  }
  return output
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Candidate);
}

async function runMain() {
  const perLevel = readOption("per-level", 1000);
  const jobs = readOption("jobs", 4);
  const batchSize = readOption("batch", 20);
  const budget = readOption("budget", 3000);
  const profiles = listProfiles();
  const results = new Map(
    profiles.map((profile) => [
      profileKey(profile),
      new Map<number, Candidate>(),
    ]),
  );
  const nextIndexes = new Map(
    profiles.map((profile) => [profileKey(profile), 0]),
  );
  const shareOf = (level: WaterSortDifficulty) =>
    Math.ceil(
      perLevel / waterSortDifficultyCriteria[level].generationProfiles.length,
    );
  const levelsOf = (profile: Profile) =>
    waterSortDifficulties
      .map(({ id }) => id)
      .filter((id) =>
        waterSortDifficultyCriteria[id].generationProfiles.some(
          (candidate) => profileKey(candidate) === profileKey(profile),
        ),
      );

  function takeUsablePrefix(profile: Profile): Candidate[] | null {
    const generated = results.get(profileKey(profile))!;
    const levels = levelsOf(profile);
    const counts = new Map(levels.map((level) => [level, 0]));
    const prefix: Candidate[] = [];
    for (let index = 0; index < budget; index += 1) {
      if (levels.every((level) => counts.get(level)! >= shareOf(level))) {
        return prefix;
      }
      const candidate = generated.get(index);
      if (!candidate) {
        return null;
      }
      prefix.push(candidate);
      const level = candidate.entry ? levelOf(candidate.entry) : null;
      if (level && counts.has(level)) {
        counts.set(level, counts.get(level)! + 1);
      }
    }
    return prefix;
  }

  async function runJob() {
    for (;;) {
      const profile = profiles
        .filter(
          (candidate) =>
            takeUsablePrefix(candidate) === null &&
            nextIndexes.get(profileKey(candidate))! < budget,
        )
        .sort(
          (left, right) =>
            nextIndexes.get(profileKey(left))! -
            nextIndexes.get(profileKey(right))!,
        )[0];
      if (!profile) {
        return;
      }

      const key = profileKey(profile);
      const start = nextIndexes.get(key)!;
      const count = Math.min(batchSize, budget - start);
      nextIndexes.set(key, start + count);
      for (const candidate of await runBatch(profile, start, count)) {
        results.get(key)!.set(candidate.index, candidate);
      }
      console.error(
        profiles
          .map(
            (candidate) =>
              `${profileKey(candidate)}:${results.get(profileKey(candidate))!.size}`,
          )
          .join(" "),
      );
    }
  }

  await Promise.all(Array.from({ length: jobs }, runJob));

  const candidates = new Map(
    profiles.map((profile) => [
      profileKey(profile),
      takeUsablePrefix(profile) ?? [],
    ]),
  );

  const levels: Record<WaterSortDifficulty, WaterSortProblemPoolEntry[]> =
    Object.fromEntries(
      waterSortDifficulties.map(({ id }) => {
        const perProfile = waterSortDifficultyCriteria[
          id
        ].generationProfiles.map((profile) =>
          candidates
            .get(profileKey(profile))!
            .flatMap(({ entry }) =>
              entry && levelOf(entry) === id ? [entry] : [],
            ),
        );
        const selected: WaterSortProblemPoolEntry[] = [];
        for (let round = 0; selected.length < perLevel; round += 1) {
          const roundEntries = perProfile
            .map((entries) => entries[round])
            .filter((entry) => entry !== undefined);
          if (roundEntries.length === 0) {
            throw new Error(
              `Only ${selected.length} level ${id} problems were generated`,
            );
          }
          selected.push(...roundEntries.slice(0, perLevel - selected.length));
        }
        return [id, selected];
      }),
    ) as Record<WaterSortDifficulty, WaterSortProblemPoolEntry[]>;

  const lines = waterSortDifficulties.map(
    ({ id }, levelIndex) =>
      `    ${JSON.stringify(id)}: [\n${levels[id]
        .map(
          (entry: WaterSortProblemPoolEntry) =>
            `      ${JSON.stringify(entry)}`,
        )
        .join(
          ",\n",
        )}\n    ]${levelIndex < waterSortDifficulties.length - 1 ? "," : ""}`,
  );
  writeFileSync(
    outputPath,
    `{\n  "generatorVersion": ${JSON.stringify(WATER_SORT_GENERATOR_VERSION)},\n  "levels": {\n${lines.join("\n")}\n  }\n}\n`,
  );

  for (const { id } of waterSortDifficulties) {
    const counts = new Map<string, number>();
    for (const [, colorCount, emptyBottleCount] of levels[id]) {
      const key = `${colorCount}色/空${emptyBottleCount}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    console.error(
      `level ${id}: ${[...counts].map(([key, count]) => `${key}=${count}`).join(" ")}`,
    );
  }
}

if (Bun.argv.includes("--worker")) {
  runWorker(Bun.argv.slice(Bun.argv.indexOf("--worker") + 1).map(Number));
} else {
  await runMain();
}

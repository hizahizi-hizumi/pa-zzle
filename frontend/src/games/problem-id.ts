/**
 * 問題を指す短い ID。生成器の版・生成条件・seed・生成試行など、問題を作るのに要る identity 全体から求める。
 * 一方向のハッシュなので、ID から問題へは問題集の索引（`createProblemPoolIdLookup`）で引く。
 */
export type ProblemId = string;

/** 各ゲームの `<Game>ProblemIdentity` と、記録に残した identity の共通の形。 */
export type ProblemIdentity = Readonly<Record<string, unknown>>;

const lane1Seed = 0xdeadbeef;
const lane2Seed = 0x41c6ce57;
const base32DigitBits = 5;
const problemIdDigitsPerLane = 5;
// 1レーンの上位25ビットを base32 の5桁にする。2レーン分の50ビットなら、1ゲーム数千問の問題集でも衝突は実用上起きない。
const discardedLaneBits = 32 - base32DigitBits * problemIdDigitsPerLane;

/**
 * identity を、キーの順序に依らない JSON 文字列へ正規化する。
 * 記録から読み戻した identity でも、問題集から作った identity と同じ文字列になる。
 */
function canonicalizeProblemIdentity(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeProblemIdentity).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const members = Object.entries(value)
      .filter(([, member]) => member !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(
        ([key, member]) =>
          `${JSON.stringify(key)}:${canonicalizeProblemIdentity(member)}`,
      );
    return `{${members.join(",")}}`;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return JSON.stringify(value);
  }
  throw new TypeError(`Problem identity cannot contain ${typeof value}`);
}

/**
 * 文字列を2本の32bitレーンへ写す（cyrb53 と同じ混合）。
 * 問題 ID は記録や URL に残るので、アルゴリズムを変えない。
 */
function hashProblemIdentityText(text: string): readonly [number, number] {
  let lane1 = lane1Seed;
  let lane2 = lane2Seed;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    lane1 = Math.imul(lane1 ^ code, 2654435761);
    lane2 = Math.imul(lane2 ^ code, 1597334677);
  }
  lane1 = Math.imul(lane1 ^ (lane1 >>> 16), 2246822507);
  lane1 ^= Math.imul(lane2 ^ (lane2 >>> 13), 3266489909);
  lane2 = Math.imul(lane2 ^ (lane2 >>> 16), 2246822507);
  lane2 ^= Math.imul(lane1 ^ (lane1 >>> 13), 3266489909);
  return [lane2 >>> 0, lane1 >>> 0];
}

function formatLane(lane: number): string {
  return (lane >>> discardedLaneBits)
    .toString(32)
    .padStart(problemIdDigitsPerLane, "0");
}

/** identity から問題 ID（`0-9a-v` の10桁）を求める。同じ identity からは常に同じ ID になる。 */
export function createProblemId(identity: ProblemIdentity): ProblemId {
  const [high, low] = hashProblemIdentityText(
    canonicalizeProblemIdentity(identity),
  );
  return formatLane(high) + formatLane(low);
}

/** 問題集の中の1問の位置。 */
export type ProblemPoolPosition<Entry> = {
  entry: Entry;
  /** 難易度の問題集の中の0始まりの並び順。 */
  entryIndex: number;
};

export type ProblemPoolIdLookup<Difficulty extends string, Entry> = (
  difficulty: Difficulty,
  problemId: string,
) => ProblemPoolPosition<Entry> | null;

/**
 * 問題集の全項目を問題 ID で引く関数を作る。索引は最初に引くときに作る。
 * 別の難易度の問題集にある ID や、問題集に無い ID には `null` を返す。
 */
export function createProblemPoolIdLookup<Difficulty extends string, Entry>(
  levels: Readonly<Record<Difficulty, readonly Entry[]>>,
  toIdentity: (entry: Entry, difficulty: Difficulty) => ProblemIdentity,
): ProblemPoolIdLookup<Difficulty, Entry> {
  type IndexedPosition = ProblemPoolPosition<Entry> & {
    difficulty: Difficulty;
  };
  let index: ReadonlyMap<ProblemId, IndexedPosition> | undefined;

  function getIndex(): ReadonlyMap<ProblemId, IndexedPosition> {
    index ??= new Map(
      (Object.keys(levels) as Difficulty[]).flatMap((difficulty) =>
        levels[difficulty].map(
          (entry, entryIndex) =>
            [
              createProblemId(toIdentity(entry, difficulty)),
              { difficulty, entry, entryIndex },
            ] as const,
        ),
      ),
    );
    return index;
  }

  return function findProblemPoolPositionById(difficulty, problemId) {
    const position = getIndex().get(problemId);
    return position?.difficulty === difficulty
      ? { entry: position.entry, entryIndex: position.entryIndex }
      : null;
  };
}

export const _private = {
  canonicalizeProblemIdentity,
};

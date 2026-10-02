import { readFileSync } from "node:fs";
import { createProblemSeededRandom } from "@/games/problem-seed";
import {
  type TsumeShogiValidation,
  validateTsumeShogiProblem,
} from "@/games/tsume-shogi/problem/generation/validator";
import { TsumeShogiMateSearch } from "@/games/tsume-shogi/puzzle/mate-search";
import {
  applyTsumeShogiMove,
  formatTsumeShogiMoveUsi,
  isTsumeShogiLegalMove,
  parseTsumeShogiMoveUsi,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  createTsumeShogiPosition,
  formatTsumeShogiPosition,
  parseTsumeShogiPosition,
  type TsumeShogiHandPieceType,
  type TsumeShogiPosition,
  tsumeShogiHandPieceTypes,
} from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiSearchPosition } from "@/games/tsume-shogi/puzzle/search-position";

const usage = `Usage: bun run --cwd frontend scripts/compare-tsume-shogi-oracle.ts -- --oracle <shtsume のパス> [options]

自作の strict validator と、外部の詰将棋 solver（USI の go mate に答えるもの。shtsume で確かめた）を同じ局面で照合する。
製品・CI には入れず、ローカルでだけ使う。oracle の取得とビルドは docs/パズル/導入調査/詰将棋/詰将棋実装前提調査.md を参照。

Options:
  --oracle <path>   oracle の実行ファイル（必須）
  --input <path>    照合する局面。1行に1つの JSON（{"sfen": string, "plies": number}）。省略すると玉の周りに駒を
                    乱数で置いた局面を作る
  --count <n>       --input を省略したときに作る局面の数 (default: 300)
  --plies <n>       --input を省略したときに調べる手数 (default: 3)
  --seed <text>     --input を省略したときの乱数の seed (default: oracle)
  --timeout <ms>    oracle の1局面あたりの制限時間 (default: 5000)
  --level <n>       oracle の探索レベル（shtsume の search_level）。低いと最短でも作意でもない詰み手順を返すことがある
                    (default: 20)
  --verdict <v>     自作の判定がこの値（accepted / unsupported / invalid）の局面だけを照合する`;

type Sample = { sfen: string; plies: number };

/** oracle の答え。詰み手順（USI）、詰まなければ `null`、制限時間内に答えなければ `"timeout"`。 */
type OracleAnswer = string[] | null | "timeout";

/**
 * oracle の答えと、oracle が持駒の余る詰み（駒余り）として、手順を参考手順とだけ示したか。
 * shtsume は駒余りと判断すると最短でも作意でもない参考手順を返す。
 */
type OracleResult = { answer: OracleAnswer; withHandLeft: boolean };

type Comparison =
  | "一致: 不詰"
  | "一致: 作意"
  | "一致: 変化同手数の作意の手数と初手"
  | "一致: 詰む（作意の比較対象外）"
  | "一致: 合駒の数え方の範囲内の手数"
  | "解釈差: 長い変化"
  | "解釈差: oracle が駒余りとした参考手順"
  | "不一致: 詰みの有無"
  | "不一致: 作意"
  | "不一致: 手数"
  | "oracle 時間切れ";

function readOption(name: string): string | undefined {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] : undefined;
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = Number(readOption(name) ?? fallback);
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`--${name} must be a positive integer`);
  }
  return value;
}

const attackerBoardPieces = ["R", "B", "G", "S", "N", "L", "P", "+R", "+B"];
const defenderBoardPieces = ["g", "s", "n", "l", "p", "b", "r"];

/** 盤の右上（1〜3筋、1〜2段）に玉を、1〜5筋・1〜5段に攻方1〜3枚・玉方0〜2枚を置き、攻方の持駒を1〜3枚持たせる。 */
function sampleRandomPositions(
  count: number,
  plies: number,
  seed: string,
): Sample[] {
  const random = createProblemSeededRandom(`tsume-shogi-oracle:${seed}`);
  function pick<T>(values: readonly T[]): T {
    return values[Math.floor(random() * values.length)]!;
  }
  const samples: Sample[] = [];
  while (samples.length < count) {
    const rows = Array.from({ length: 9 }, () => Array<string>(9).fill(""));
    rows[Math.floor(random() * 2)]![8 - Math.floor(random() * 3)] = "k";
    function place(piece: string): void {
      const rank = Math.floor(random() * 5);
      const column = 8 - Math.floor(random() * 5);
      if (rows[rank]![column] === "") {
        rows[rank]![column] = piece;
      }
    }
    const attackerCount = 1 + Math.floor(random() * 3);
    for (let index = 0; index < attackerCount; index += 1) {
      place(pick(attackerBoardPieces));
    }
    const defenderCount = Math.floor(random() * 3);
    for (let index = 0; index < defenderCount; index += 1) {
      place(pick(defenderBoardPieces));
    }
    const board = rows
      .map((row) =>
        row
          .map((piece) => (piece === "" ? "1" : piece))
          .join("")
          .replace(/1+/g, (ones) => String(ones.length)),
      )
      .join("/");
    const hand: Partial<Record<TsumeShogiHandPieceType, number>> = {};
    const handCount = 1 + Math.floor(random() * 3);
    for (let index = 0; index < handCount; index += 1) {
      const type = pick(tsumeShogiHandPieceTypes);
      hand[type] = (hand[type] ?? 0) + 1;
    }
    let position: TsumeShogiPosition;
    try {
      position = createTsumeShogiPosition(board, hand);
    } catch {
      continue;
    }
    samples.push({ sfen: formatTsumeShogiPosition(position), plies });
  }
  return samples;
}

/** `sfen` の無い行（生成スクリプトの `--details` で、上限まで作れなかった候補）は飛ばす。 */
function readSamples(path: string): Sample[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      const { sfen, plies } = JSON.parse(line) as Partial<Sample>;
      return sfen === undefined || plies === undefined ? [] : [{ sfen, plies }];
    });
}

/** USI で1つの oracle の process と順に対話する。 */
class UsiOracle {
  readonly #process: Bun.Subprocess<"pipe", "pipe", "inherit">;
  readonly #lines: AsyncIterator<string>;

  readonly #searchLevel: number;

  constructor(path: string, searchLevel: number) {
    this.#searchLevel = searchLevel;
    this.#process = Bun.spawn([path], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "inherit",
    });
    this.#lines = readLines(this.#process.stdout);
  }

  async start(): Promise<void> {
    this.#send("usi");
    await this.#waitFor((line) => line === "usiok");
    this.#send("setoption name USI_Hash value 64");
    this.#send(`setoption name search_level value ${this.#searchLevel}`);
    this.#send("isready");
    await this.#waitFor((line) => line === "readyok");
    this.#send("usinewgame");
  }

  async solve(
    sfen: string,
    timeoutMilliseconds: number,
  ): Promise<OracleResult> {
    this.#send(`position sfen ${sfen}`);
    this.#send(`go mate ${timeoutMilliseconds}`);
    let withHandLeft = false;
    const line = await this.#waitFor((text) => {
      withHandLeft ||= text.includes("Checkmate with hand");
      return text.startsWith("checkmate");
    });
    const answer = line.slice("checkmate".length).trim();
    if (answer === "nomate") {
      return { answer: null, withHandLeft };
    }
    if (answer === "timeout" || answer === "notimplemented") {
      return { answer: "timeout", withHandLeft };
    }
    return { answer: answer.split(/\s+/), withHandLeft };
  }

  stop(): void {
    this.#send("quit");
    this.#process.stdin.end();
  }

  #send(command: string): void {
    this.#process.stdin.write(`${command}\n`);
    this.#process.stdin.flush();
  }

  async #waitFor(isTarget: (line: string) => boolean): Promise<string> {
    for (;;) {
      const next = await this.#lines.next();
      if (next.done) {
        throw new Error("oracle が終了しました");
      }
      if (isTarget(next.value)) {
        return next.value;
      }
    }
  }
}

async function* readLines(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      yield buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }
}

/**
 * 自作の判定と oracle の答えを比べる。oracle の答えは次の点で自作と違いうるので、違いを説明できるものは不一致にしない。
 * - 無駄合を手数に数えない。無駄合の判定は解釈によって違うので、自作の「合駒をすべて数える」手数と
 *   「合駒をどれも逃れに数えない」手数（`shortestMatePliesIgnoringInterposition`）の間にあれば一致とする。
 * - 最長の手順で駒が余り、短い手順で余らないなら、短い方を作意とする（2手変長など）。自作は最長を作意とする。
 *   変化の駒余りの見方も自作（攻方は持駒が少なく残る詰め方を選ぶ）と違いうるので、oracle の手順より長く逃れて詰む
 *   変化があることだけを確かめる。
 * - 駒余りと判断した局面では、最短でも作意でもない参考手順を返す。駒余りの判断は自作と違いうる（自作が駒余りの無い
 *   一意の作意を見つけた局面でも駒余りとすることがある）ので、自作が採用した局面では、参考手順が自作の作意より
 *   短くないことだけを確かめる。
 * - 変化同手数の応手の選び方が違う。
 * 作意そのものの一致は、自作が `accepted` とした局面だけで比べる。
 */
function compare(
  sample: Sample,
  validation: TsumeShogiValidation,
  oracle: OracleAnswer,
  oracleWithHandLeft: boolean,
): Comparison {
  if (oracle === "timeout") {
    return "oracle 時間切れ";
  }
  const strict = validation.shortestMatePlies;
  const ignoringInterposition =
    validation.shortestMatePliesIgnoringInterposition;
  const oracleWithinPlies =
    oracle !== null && oracle.length <= validation.plies;
  if (
    ignoringInterposition === null ||
    (strict === null && !oracleWithinPlies)
  ) {
    if (!oracleWithinPlies) {
      return "一致: 不詰";
    }
    return hasLongerVariation(sample.sfen, oracle)
      ? "解釈差: 長い変化"
      : "不一致: 詰みの有無";
  }
  if (oracle === null) {
    return "不一致: 詰みの有無";
  }
  if (oracle.length < ignoringInterposition) {
    return hasLongerVariation(sample.sfen, oracle)
      ? "解釈差: 長い変化"
      : "不一致: 手数";
  }
  if (ignoringInterposition !== strict) {
    return "一致: 合駒の数え方の範囲内の手数";
  }
  if (validation.verdict !== "accepted") {
    return "一致: 詰む（作意の比較対象外）";
  }
  const mainLine = validation.mainLine!;
  const ours = mainLine.moves.map(formatTsumeShogiMoveUsi);
  if (ours.join(" ") === oracle.join(" ")) {
    return "一致: 作意";
  }
  if (oracleWithHandLeft && oracle.length >= ours.length) {
    return "解釈差: oracle が駒余りとした参考手順";
  }
  const hasTiedDefense = mainLine.defenderTurns.some(
    (turn) => turn.tiedResponseCount > 1,
  );
  return hasTiedDefense &&
    ours.length === oracle.length &&
    ours[0] === oracle[0]
    ? "一致: 変化同手数の作意の手数と初手"
    : "不一致: 作意";
}

/** 長い変化を探す手数の上限（oracle の残りの手数に足す手数）。 */
const longerVariationMargin = 6;

/** oracle の手順のどこかの玉方の手番で、oracle の手数より長く逃れる応手があり、逃れの先がどれも少し長い手数で詰むか。 */
function hasLongerVariation(
  sfen: string,
  oracleMoves: readonly string[],
): boolean {
  const search = new TsumeShogiMateSearch();
  let position = parseTsumeShogiPosition(sfen);
  for (const [index, usi] of oracleMoves.entries()) {
    const move = parseTsumeShogiMoveUsi(usi);
    if (!isTsumeShogiLegalMove(position, move)) {
      return false;
    }
    const remaining = oracleMoves.length - index;
    if (
      index % 2 === 1 &&
      !search.isMateWithin(new TsumeShogiSearchPosition(position), remaining)
    ) {
      return listEscapes(position, remaining, search).every(
        (escaped) =>
          search.findShortestMate(
            new TsumeShogiSearchPosition(escaped),
            remaining - 1 + longerVariationMargin,
          ) !== null,
      );
    }
    position = applyTsumeShogiMove(position, move);
  }
  return false;
}

/** 玉方の手番の局面で、残り `remaining` 手以内に詰まなくなる応手を指した後の局面。 */
function listEscapes(
  position: TsumeShogiPosition,
  remaining: number,
  search: TsumeShogiMateSearch,
): TsumeShogiPosition[] {
  const state = new TsumeShogiSearchPosition(position);
  const escapes: TsumeShogiPosition[] = [];
  for (const response of state.listDefenderResponses()) {
    state.play(response);
    if (!search.isMateWithin(state, remaining - 1)) {
      escapes.push(state.toPosition());
    }
    state.undo(response);
  }
  return escapes;
}

async function runMain(): Promise<void> {
  const oraclePath = readOption("oracle");
  if (oraclePath === undefined || Bun.argv.includes("--help")) {
    console.log(usage);
    return;
  }
  const inputPath = readOption("input");
  const samples =
    inputPath === undefined
      ? sampleRandomPositions(
          readPositiveInteger("count", 300),
          readPositiveInteger("plies", 3),
          readOption("seed") ?? "oracle",
        )
      : readSamples(inputPath);
  const timeoutMilliseconds = readPositiveInteger("timeout", 5000);

  const oracle = new UsiOracle(oraclePath, readPositiveInteger("level", 20));
  await oracle.start();
  const counts = new Map<string, number>();
  const mismatches: string[] = [];
  const onlyVerdict = readOption("verdict");
  let comparedCount = 0;
  for (const sample of samples) {
    const validation = validateTsumeShogiProblem(
      parseTsumeShogiPosition(sample.sfen),
      sample.plies,
    );
    if (onlyVerdict !== undefined && validation.verdict !== onlyVerdict) {
      continue;
    }
    comparedCount += 1;
    const { answer, withHandLeft } = await oracle.solve(
      sample.sfen,
      timeoutMilliseconds,
    );
    const comparison = compare(sample, validation, answer, withHandLeft);
    const key = `${comparison} (${validation.verdict})`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!comparison.startsWith("一致")) {
      mismatches.push(
        `${comparison}: ${sample.sfen} plies=${sample.plies} 自作=${validation.verdict}[${validation.issues.join(",")}] ${validation.mainLine?.moves.map(formatTsumeShogiMoveUsi).join(" ") ?? "不詰"} / oracle=${Array.isArray(answer) ? answer.join(" ") : answer}`,
      );
    }
  }
  oracle.stop();

  console.log(`${comparedCount}局面を照合（候補 ${samples.length}局面）`);
  for (const [key, count] of [...counts].sort()) {
    console.log(`  ${key}: ${count}`);
  }
  for (const mismatch of mismatches) {
    console.log(mismatch);
  }
  if (mismatches.some((line) => line.startsWith("不一致"))) {
    process.exitCode = 1;
  }
}

await runMain();

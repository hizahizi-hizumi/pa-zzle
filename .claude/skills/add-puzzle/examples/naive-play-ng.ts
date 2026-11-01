// ノノグラム: マスを塗る・消す。補助は「ヒントにちょうど合った行・列が分かる」だけ（正誤は出ない）。
// 汎用のプレイヤー（補助なしの当てずっぽう・一致した行・列の数で貪欲・試し塗りして戻す）と、
// ノノグラム実装前提調査 §11.6 の試し塗りのプレイヤー（空の行と重なりだけ読み、数えて分かる破綻で戻す）を比べる。
// 使い方は scripts/naive-play-core.ts の冒頭。引数は frontend/src/games/nonogram のパス。
import {
  type Adapter,
  fmt,
  greedy,
  greedyBacktrack,
  type PlayResult,
  type Player,
  randomBlind,
  readNaivePlayOptions,
  runLevel,
  sampleEvenly,
  type Summary,
  tableHeader,
} from "../scripts/naive-play-core.ts";

const options = readNaivePlayOptions({ n: 30, plays: 3, levels: [1, 2, 3, 4, 5] });

type Clue = readonly number[];
type Ctx = {
  width: number;
  height: number;
  rows: readonly Clue[];
  columns: readonly Clue[];
  solution: readonly boolean[];
  blackCount: number;
  lineCells: number[][]; // 行（上から）、続けて列（左から）のマスの位置
  linesThroughCell: number[][];
  clueOf(lineIndex: number): Clue;
  runsOf(black: readonly boolean[]): number[];
  solveLine(clue: Clue, line: readonly number[]): number[] | null; // -1 未確定, 0 白, 1 黒
};

// 状態: 塗ったマス（0/1）と、ヒントに一致した行・列の数
type S = { filled: Uint8Array; matched: Uint8Array; matchCount: number; fillCount: number };
type M = number; // 塗る・消すマスの位置

function sameClue(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function makeAdapter(ctx: Ctx): Adapter<S, M> & { ctx: Ctx } {
  const n = ctx.width * ctx.height;
  const lineMatches = (filled: Uint8Array, lineIndex: number) =>
    sameClue(
      ctx.runsOf(ctx.lineCells[lineIndex]!.map((i) => filled[i] === 1)),
      ctx.clueOf(lineIndex),
    );
  const initialFilled = new Uint8Array(n);
  const initialMatched = new Uint8Array(ctx.lineCells.length);
  ctx.lineCells.forEach((_, l) => {
    initialMatched[l] = lineMatches(initialFilled, l) ? 1 : 0;
  });
  const initial: S = {
    filled: initialFilled,
    matched: initialMatched,
    matchCount: initialMatched.reduce((t, v) => t + v, 0),
    fillCount: 0,
  };
  const all = Array.from({ length: n }, (_, i) => i);
  const apply = (s: S, i: M): S => {
    const filled = s.filled.slice();
    filled[i] = filled[i] ? 0 : 1;
    const matched = s.matched.slice();
    let matchCount = s.matchCount;
    for (const l of ctx.linesThroughCell[i]!) {
      const now = lineMatches(filled, l) ? 1 : 0;
      matchCount += now - matched[l]!;
      matched[l] = now;
    }
    return { filled, matched, matchCount, fillCount: s.fillCount + (filled[i] ? 1 : -1) };
  };
  return {
    ctx,
    initial,
    minMoves: ctx.blackCount,
    legalMoves: () => all,
    blindMoves: () => all,
    apply,
    isCleared: (s) => s.filled.every((v, i) => (v === 1) === ctx.solution[i]),
    key: (s) => s.filled.join(""),
    progress: (s) => s.matchCount,
  };
}

/**
 * 実装前提調査 §11.6 の素朴なプレイヤー（研究用 Python の naive_play と同じ手順）。
 * 最初に、空の行・列と、何も決まっていない行・列の重なりだけを読む。以降は行・列を読まない。
 * 補助ありでは、塗りがヒントにちょうど合った行・列の残りを×にする（知らせを信じる）。
 * 黒の足りない数が最も少ない行・列の未確定マス（塗ったマスの隣を優先）を試しに塗り、数えるだけで分かる破綻
 * （塗りすぎ・塊が長すぎる・埋まったのに合わない・足りない）が出たら戻して×にする。破綻が出ないまま行き詰まったら
 * 最後の試し塗りまで戻る（深さ優先）。moves は塗った回数（最初の読みの塗りを含む）、undos は戻した試し塗りの回数。
 */
function trialFill(aid: boolean, budget: number, id: string): Player {
  return {
    id,
    aid,
    play(adapter) {
      const { ctx } = adapter as unknown as { ctx: Ctx };
      const n = ctx.width * ctx.height;
      const r: PlayResult = { solved: false, moves: 0, failures: 0, restarts: 0, undos: 0 };
      const grid = new Array<number>(n).fill(-1);
      ctx.lineCells.forEach((cells, l) => {
        const solved = ctx.solveLine(ctx.clueOf(l), cells.map(() => -1))!;
        cells.forEach((cell, k) => {
          if (solved[k] !== -1 && grid[cell] === -1) {
            grid[cell] = solved[k]!;
            if (solved[k] === 1) r.moves += 1;
          }
        });
      });
      const visiblyBroken = (clue: Clue, line: number[]) => {
        const filledRuns = ctx.runsOf(line.map((v) => v === 1));
        const blacks = line.filter((v) => v === 1).length;
        const unknown = line.filter((v) => v === -1).length;
        const total = clue.reduce((t, v) => t + v, 0);
        if (blacks > total) return true;
        if (blacks + unknown < total) return true;
        const longest = Math.max(0, ...clue);
        if (filledRuns.some((run) => run > longest)) return true;
        if (unknown === 0 && !sameClue(filledRuns, clue)) return true;
        return false;
      };
      const settle = (g: number[]) => {
        let changed = true;
        while (changed) {
          changed = false;
          for (const [l, cells] of ctx.lineCells.entries()) {
            const line = cells.map((c) => g[c]!);
            const clue = ctx.clueOf(l);
            if (visiblyBroken(clue, line)) return false;
            if (aid && sameClue(ctx.runsOf(line.map((v) => v === 1)), clue)) {
              for (const c of cells) {
                if (g[c] === -1) {
                  g[c] = 0;
                  changed = true;
                }
              }
            }
          }
        }
        return true;
      };
      const cleared = (g: number[]) => g.every((v, i) => (v === 1) === ctx.solution[i]);
      const choose = (g: number[]) => {
        let best: { missing: number; unknown: number; cell: number } | null = null;
        for (const [l, cells] of ctx.lineCells.entries()) {
          const line = cells.map((c) => g[c]!);
          const missing = ctx.clueOf(l).reduce((t, v) => t + v, 0) - line.filter((v) => v === 1).length;
          if (missing <= 0) continue;
          const unknownCells = cells.filter((_, k) => line[k] === -1);
          if (unknownCells.length === 0) continue;
          const adjacent = cells.filter(
            (_, k) => line[k] === -1 && ((k > 0 && line[k - 1] === 1) || (k + 1 < line.length && line[k + 1] === 1)),
          );
          const cell = adjacent[0] ?? unknownCells[0]!;
          if (
            best === null ||
            missing < best.missing ||
            (missing === best.missing && unknownCells.length < best.unknown)
          ) {
            best = { missing, unknown: unknownCells.length, cell };
          }
        }
        return best?.cell ?? null;
      };
      let nodes = 0;
      const search = (g: number[]): boolean => {
        nodes += 1;
        if (nodes > budget) return false;
        if (!settle(g)) return false;
        if (cleared(g)) return true;
        const cell = choose(g);
        if (cell === null) return false;
        const black = g.slice();
        black[cell] = 1;
        r.moves += 1;
        if (search(black)) return true;
        if (nodes > budget) return false;
        r.undos += 1;
        const white = g.slice();
        white[cell] = 0;
        return search(white);
      };
      r.solved = settle(grid) && (cleared(grid) || search(grid));
      return r;
    },
  };
}

function players(blacks: number) {
  return [
    randomBlind({ maxMovesPerAttempt: blacks * 2, maxAttempts: 5 }, "random-fill(no aid)"),
    greedy({ maxMovesPerAttempt: blacks * 3, maxAttempts: 5, sideways: false }, "greedy-keep(aid)"),
    greedy({ maxMovesPerAttempt: blacks * 3, maxAttempts: 5, sideways: true }, "greedy-best(aid)"),
    greedyBacktrack({ undoBudget: 50, maxMoves: blacks * 20 }, "backtrack50(aid)"),
    trialFill(false, 3000, "trial-fill(no aid)"),
    trialFill(true, 3000, "trial-fill(aid)"),
  ];
}

async function loadVersion(root: string) {
  const pool = await import(`${root}/problem/problem-pool.ts`);
  const clue = await import(`${root}/puzzle/clue.ts`);
  const board = await import(`${root}/puzzle/board.ts`);
  const solver = await import(`${root}/problem/generation/line-solver.ts`);
  return (entry: [number, number, number, number, string, ...number[]]): Ctx => {
    const [width, height, , , encoded] = entry;
    const pattern = pool.decodeNonogramPoolSolution({ width, height }, encoded);
    const clues = clue.computeNonogramClues(pattern);
    const lines = board.listNonogramLines(pattern) as { axis: string; index: number }[];
    const lineCells = lines.map((line) => board.getNonogramLineCellIndices(pattern, line) as number[]);
    const linesThroughCell: number[][] = Array.from({ length: width * height }, () => []);
    lineCells.forEach((cells, l) => {
      for (const c of cells) linesThroughCell[c]!.push(l);
    });
    const allClues: Clue[] = [...clues.rows, ...clues.columns];
    return {
      width,
      height,
      rows: clues.rows,
      columns: clues.columns,
      solution: pattern.black,
      blackCount: pattern.black.filter(Boolean).length,
      lineCells,
      linesThroughCell,
      clueOf: (l) => allClues[l]!,
      runsOf: (black) => clue.computeNonogramLineClue(black),
      solveLine: (c, line) => solver.solveNonogramLineFully(c, line),
    };
  };
}

const out: Summary[] = [];
for (const root of options.roots) {
  const toCtx = await loadVersion(root);
  const json = (await import(`${root}/problem/problem-pool.json`)).default as {
    levels: Record<string, [number, number, number, number, string, ...number[]][]>;
  };
  for (const level of options.levels) {
    const t0 = Date.now();
    const entries = sampleEvenly(json.levels[String(level)]!, options.n);
    const ctxs = entries.map(toCtx);
    const blacks = Math.max(...ctxs.map((c) => c.blackCount));
    const sizes = [...new Set(ctxs.map((c) => `${c.width}x${c.height}`))].join("/");
    out.push(
      ...runLevel(
        { game: "nonogram", version: root.split("/").slice(-5, -4).join(""), level: `${level} (${sizes})` },
        ctxs,
        makeAdapter,
        players(blacks),
        options.plays,
      ),
    );
    console.error(`${root} ${level} ${Date.now() - t0}ms`);
  }
}
console.log(tableHeader);
for (const s of out) console.log(fmt(s));

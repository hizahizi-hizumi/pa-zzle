// リフレクション: 陽性 429a2e43^（一致表示あり・旧難易度・問題集 v1）と陰性 origin/main（問題集 v4）
import {
  type Adapter,
  fmt,
  greedy,
  greedyBacktrack,
  randomBlind,
  runLevel,
  sampleEvenly,
  type Summary,
  tableHeader,
} from "../scripts/naive-play-core.ts";

const N = Number(process.env.N ?? 30);
const PLAYS = Number(process.env.PLAYS ?? 3);
const which = process.argv[2] ?? "both";
const levelsArg = process.env.LEVELS ? process.env.LEVELS.split(",").map(Number) : [1, 3, 5];

const PIECES = ["slash", "backslash", "vertical-double", "horizontal-double", "reflector", "black-hole"] as const;
type Cell = (typeof PIECES)[number] | null;

// 盤面の変更: cellIndex を cell にする（移動は2つ）
type M = readonly { i: number; c: Cell }[];

type Ctx = {
  size: number;
  clues: readonly { outcome: string; distance: number }[];
  entries: readonly { side: string; index: number }[];
  // biome-ignore lint: any
  trace(cells: readonly Cell[], e: number): { outcome: string; distance: number; path: { cellIndex: number }[]; exit: any };
  match(e: number, tr: { outcome: string; distance: number; exit: { side: string; index: number } | null }): boolean;
  solved(cells: readonly Cell[]): boolean;
  inventory: Record<string, number>;
};

class St {
  cells: Cell[];
  stock: Record<string, number>;
  paths: number[][]; // 外周ヒントごとの通るマス
  matches: boolean[];
  matchCount: number;
  placed: number;
  private _idx?: number[][];
  constructor(cells: Cell[], stock: Record<string, number>, paths: number[][], matches: boolean[], placed: number) {
    this.cells = cells;
    this.stock = stock;
    this.paths = paths;
    this.matches = matches;
    this.matchCount = matches.filter(Boolean).length;
    this.placed = placed;
  }
  cellToClues(size: number): number[][] {
    if (!this._idx) {
      const idx: number[][] = Array.from({ length: size * size }, () => []);
      this.paths.forEach((p, e) => {
        for (const c of p) if (idx[c]!.at(-1) !== e) idx[c]!.push(e);
      });
      this._idx = idx;
    }
    return this._idx;
  }
}

function makeAdapter(ctx: Ctx): Adapter<St, M> {
  const n = ctx.size * ctx.size;
  const E = ctx.entries.length;
  const empty: Cell[] = new Array(n).fill(null);
  const paths: number[][] = [];
  const matches: boolean[] = [];
  for (let e = 0; e < E; e += 1) {
    const tr = ctx.trace(empty, e);
    paths.push(tr.path.map((s) => s.cellIndex));
    matches.push(ctx.match(e, tr));
  }
  const initial = new St(empty, { ...ctx.inventory }, paths, matches, 0);
  const total = Object.values(ctx.inventory).reduce((a, b) => a + b, 0);

  const apply = (s: St, m: M): St | null => {
    const cells = s.cells.slice();
    const stock = { ...s.stock };
    for (const { i, c } of m) {
      const old = cells[i]!;
      if (old !== null) stock[old] = (stock[old] ?? 0) + 1;
      if (c !== null) {
        if ((stock[c] ?? 0) <= 0) return null;
        stock[c]! -= 1;
      }
      cells[i] = c;
    }
    const idx = s.cellToClues(ctx.size);
    const affected = new Set<number>();
    for (const { i } of m) for (const e of idx[i]!) affected.add(e);
    const newPaths = s.paths.slice();
    const newMatches = s.matches.slice();
    for (const e of affected) {
      const tr = ctx.trace(cells, e);
      newPaths[e] = tr.path.map((x) => x.cellIndex);
      newMatches[e] = ctx.match(e, tr);
    }
    const placed = cells.reduce((t, c) => t + (c === null ? 0 : 1), 0);
    return new St(cells, stock, newPaths, newMatches, placed);
  };

  const placements = (s: St): M[] => {
    const ms: M[] = [];
    const types = PIECES.filter((p) => (s.stock[p] ?? 0) > 0);
    for (let i = 0; i < n; i += 1) {
      if (s.cells[i] !== null) continue;
      for (const t of types) ms.push([{ i, c: t }]);
    }
    return ms;
  };

  const legalMoves = (s: St): M[] => {
    const ms = placements(s);
    const types = PIECES.filter((p) => (s.stock[p] ?? 0) > 0);
    for (let i = 0; i < n; i += 1) {
      const c = s.cells[i];
      if (c === null) continue;
      ms.push([{ i, c: null }]); // 戻す
      for (const t of types) if (t !== c) ms.push([{ i, c: t }]); // 置き換え
      for (let j = 0; j < n; j += 1) {
        if (s.cells[j] === null) ms.push([{ i, c: null }, { i: j, c }]); // 移す
      }
    }
    return ms;
  };

  return {
    initial,
    minMoves: total,
    legalMoves,
    // 補助なし: 一致表示を見ないので、置き切るまで適当に置く。置き切って解けていなければ詰み（最初から）
    blindMoves: (s) => placements(s),
    apply,
    isCleared: (s) => s.placed === total && s.matchCount === E && ctx.solved(s.cells),
    key: (s) => s.cells.map((c) => (c === null ? 0 : PIECES.indexOf(c) + 1)).join(""),
    progress: (s) => s.matchCount + 0.1 * s.placed,
  };
}

async function loadVersion(root: string, matchKind: "old" | "new") {
  const laser = await import(`${root}/puzzle/laser.ts`);
  const rules = await import(`${root}/puzzle/rules.ts`);
  const boardMod = await import(`${root}/puzzle/board.ts`);
  const pool = await import(`${root}/problem/problem-pool.ts`);
  const json = (await import(`${root}/problem/problem-pool.json`)).default;
  return (encoded: string): Ctx => {
    const solution = pool.decodeReflectionPoolSolution(encoded);
    const size = solution.size;
    const clues = laser.computeReflectionClues(solution);
    const entries = laser.listReflectionEntries(size);
    const entryIndex = (x: { side: string; index: number }) =>
      ["top", "right", "bottom", "left"].indexOf(x.side) * size + x.index;
    const inventory = boardMod.countReflectionBoardPieces(solution);
    return {
      size,
      clues,
      entries,
      inventory,
      trace: (cells, e) => laser.traceReflectionLaser({ size, cells }, entries[e]),
      match: (e, tr) =>
        matchKind === "old"
          ? laser.isSameReflectionClue(tr, clues[e])
          : rules.isReflectionClueMatch(clues, e, tr, tr.exit === null ? null : entryIndex(tr.exit)),
      solved: (cells) => rules.isReflectionSolved({ size, cells }, { inventory, clues }),
    };
  };
  // biome-ignore lint: unreachable
  void json;
}

function players(pieces: number) {
  return [
    randomBlind({ maxMovesPerAttempt: pieces, maxAttempts: 5 }, "random-place(no aid)"),
    greedy({ maxMovesPerAttempt: pieces * 10 + 20, maxAttempts: 5, sideways: false }, "greedy-keep(aid)"),
    greedy({ maxMovesPerAttempt: pieces * 10 + 20, maxAttempts: 5, sideways: true }, "greedy-best(aid)"),
    greedyBacktrack({ undoBudget: 50, maxMoves: pieces * 20 + 40 }, "backtrack50(aid)"),
  ];
}

const POS = "/tmp/naive/rf-pos/frontend/src/games/reflection";
const MAIN = "/tmp/naive/main/frontend/src/games/reflection";
const versions = [
  { name: "pos 429a2e43^", root: POS, pool: POS, kind: "old" as const, w: "pos" },
  { name: "neg main", root: MAIN, pool: MAIN, kind: "new" as const, w: "neg" },
  // 交差: 問題集と一致表示の定義のどちらが効いているか
  { name: "pos pool + main rules(new match)", root: MAIN, pool: POS, kind: "new" as const, w: "cross1" },
  { name: "main pool + pos rules(old match)", root: POS, pool: MAIN, kind: "old" as const, w: "cross2" },
];

const out: Summary[] = [];
for (const v of versions) {
  if (which !== "both" && which !== v.w) continue;
  const toCtx = await loadVersion(v.root, v.kind);
  const json = (await import(`${v.pool}/problem/problem-pool.json`)).default as {
    levels: Record<string, [number, string, ...number[]][]>;
  };
  for (const level of levelsArg) {
    const t0 = Date.now();
    const entries = sampleEvenly(json.levels[String(level)]!, N);
    const ctxs = entries.map((e) => toCtx(e[1]));
    const pieces = Math.max(...ctxs.map((c) => Object.values(c.inventory).reduce((a, b) => a + b, 0)));
    const sizes = [...new Set(ctxs.map((c) => c.size))].join("/");
    out.push(
      ...runLevel(
        { game: "reflection", version: v.name, level: `${level} (${sizes}, ≤${pieces}p)` },
        ctxs,
        makeAdapter,
        players(pieces),
        PLAYS,
      ),
    );
    console.error(`${v.name} ${level} ${Date.now() - t0}ms`);
  }
}
console.log(tableHeader);
for (const s of out) console.log(fmt(s));

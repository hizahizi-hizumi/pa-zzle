// 素朴なプレイヤーのシミュレーション: ゲームに依存しない部分。
//
// 素朴なプレイヤー（補助なしの当てずっぽう・合法手のランダム・貪欲・試し置きして戻す）に各レベルの問題を解かせ、
// 解ける割合と手数の表を出す。最上位を補助ありの素朴なプレイヤーがほぼ必ず・最短に近い手数で解くなら「簡単すぎる」候補。
// 素朴なプレイヤーが苦労しても熟練者に難しいとは限らないので、止める向き（簡単すぎるの検出）にだけ使い、
// 難しいことの根拠にしない。
//
// アダプタの書き方（`examples/naive-play-*.ts` が手本）:
//   - ゲームのディレクトリ（`frontend/src/games/<game>`）を引数で受け、`readNaivePlayOptions()` で読む。
//     ルール・状態・問題集のモジュールは `await import(`${root}/puzzle/rules.ts`)` のように動的に読む。
//     ディレクトリを複数渡すと、版ごと（main と作業中の worktree など）の行が並ぶ。
//   - 1問ぶんの `Adapter` を作る。legalMoves は合意した補助表示のもとでプレイヤーに見える手、
//     blindMoves は補助なしで入力できる手、progress は盤面が見せる進み具合（一致表示の数など）にする。
//     補助表示を変えたら、それに合わせて legalMoves・progress を変えて測り直す。
//     legalMoves に取り消しの手（塗ったマスを消す・置いた駒を戻す）を入れない。入れると試し置きのプレイヤーが
//     常に未訪問の盤面を見つけて行き詰まらず、一度も戻らない（表の undos が全レベル0なら疑う）。
//   - レベルごとに問題集から `sampleEvenly` で N 問を抜き、`runLevel` に players を渡す。
//     最後に `tableHeader` と `fmt` で表を標準出力へ書く。進み具合のログは標準エラーへ書く。
//
// 実行（アダプタのある版のルートで。新しいパズルのアダプタは段の worktree にあるので、worktree のルートで流す。
// `@/` の解決に対象の版の `frontend/tsconfig.json` が使われる）:
//   N=30 PLAYS=3 LEVELS=1,3,5 bun .claude/skills/add-puzzle/examples/naive-play-ws.ts <worktree>/frontend/src/games/water-sort
//   - N: レベルごとに抜く問題数
//   - PLAYS: 1問を同じプレイヤーが遊ぶ回数（乱数の種を変える）
//   - LEVELS: 測るレベルをカンマ区切りで
//
// 表の読み方（1行 = 版 × レベル × プレイヤー）:
//   - solved 1st try: 最初の試行で解けた割合。solved (all tries): 試行の上限までに解けた割合
//   - solved w/o failure: 不成立の入力なしで解けた割合（補助なしのプレイヤーで意味を持つ）
//   - moves(med, solved): 解けたときの手数の中央値。moves/min: 最短手数との比（1 に近いほど迷っていない）
//   - failures・attempts・undos: 不成立の入力・試行・1手戻しの回数
//   上位のレベルほど解ける割合が下がり手数の比が上がるか、最上位で補助ありの行が 1 に近い比でほぼ解いていないかを見る。

import { resolve } from "node:path";

export type Rng = () => number;

export type NaivePlayOptions = {
  roots: string[];
  n: number;
  plays: number;
  levels: number[];
};

/** 引数のゲームのディレクトリと、環境変数 N / PLAYS / LEVELS を読む。 */
export function readNaivePlayOptions(defaults: { n: number; plays: number; levels: number[] }): NaivePlayOptions {
  const roots = process.argv.slice(2);
  if (roots.length === 0) {
    console.error("使い方: [N=..] [PLAYS=..] [LEVELS=1,3,5] bun <アダプタ>.ts <frontend/src/games/<game> のパス>...");
    process.exit(2);
  }
  return {
    roots: roots.map((root) => resolve(root)),
    n: Number(process.env.N ?? defaults.n),
    plays: Number(process.env.PLAYS ?? defaults.plays),
    levels: process.env.LEVELS ? process.env.LEVELS.split(",").map(Number) : defaults.levels,
  };
}

export function makeRng(seed: string): Rng {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let v = state;
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

export function pick<T>(xs: readonly T[], rng: Rng): T | undefined {
  return xs[Math.floor(rng() * xs.length)];
}

/**
 * 1問ぶんのゲーム。プレイヤーはこれだけを見て遊ぶ。
 * - legalMoves: ルール上成立する手（UI が「押せる所だけ押せる」なら、補助ありのプレイヤーが見える手）
 * - blindMoves: 補助なしで入力できる手（成立しない手を含む）。apply が null を返したら不成立1回
 * - progress: 盤面が見せる進み具合（一致表示の数など）。補助ありのプレイヤーだけが使う。大きいほど良い
 */
export type Adapter<S, M> = {
  initial: S;
  legalMoves(s: S): M[];
  blindMoves?(s: S): M[];
  apply(s: S, m: M): S | null;
  isCleared(s: S): boolean;
  key(s: S): string;
  progress?(s: S): number;
  minMoves?: number; // 最短手数（分かれば）。手数の比を出す
};

export type PlayResult = {
  solved: boolean;
  moves: number; // 成立した手（全試行の累計）
  failures: number; // 不成立の入力
  restarts: number; // 盤面を最初から（試行回数 - 1）
  undos: number; // 1手戻す
  minMoves?: number;
};

export type Player = {
  id: string;
  aid: boolean;
  play<S, M>(a: Adapter<S, M>, rng: Rng): PlayResult;
};

type Budget = { maxMovesPerAttempt: number; maxAttempts: number };

/** 合法手から一様に選ぶ。訪れた局面へは戻らない。詰んだら最初から。 */
export function randomLegal(b: Budget, id = "random"): Player {
  return {
    id,
    aid: true,
    play(a, rng) {
      const r: PlayResult = { solved: false, moves: 0, failures: 0, restarts: 0, undos: 0 };
      for (let attempt = 0; attempt < b.maxAttempts; attempt += 1) {
        if (attempt > 0) r.restarts += 1;
        let s = a.initial;
        const seen = new Set([a.key(s)]);
        for (let i = 0; i < b.maxMovesPerAttempt; i += 1) {
          if (a.isCleared(s)) break;
          const nexts = a
            .legalMoves(s)
            .map((m) => a.apply(s, m))
            .filter((x): x is NonNullable<typeof x> => x !== null && !seen.has(a.key(x)));
          const n = pick(nexts, rng);
          if (!n) break;
          s = n;
          seen.add(a.key(s));
          r.moves += 1;
        }
        if (a.isCleared(s)) {
          r.solved = true;
          return r;
        }
      }
      return r;
    },
  };
}

/** 補助なし: 入力できる手から一様に選ぶ。不成立は数えて続ける。 */
export function randomBlind(b: Budget, id = "blind"): Player {
  return {
    id,
    aid: false,
    play(a, rng) {
      const r: PlayResult = { solved: false, moves: 0, failures: 0, restarts: 0, undos: 0 };
      const blind = a.blindMoves ?? a.legalMoves;
      for (let attempt = 0; attempt < b.maxAttempts; attempt += 1) {
        if (attempt > 0) r.restarts += 1;
        let s = a.initial;
        const seen = new Set([a.key(s)]);
        let actions = 0;
        let stale = 0;
        while (actions < b.maxMovesPerAttempt * 20 && !a.isCleared(s)) {
          actions += 1;
          const m = pick(blind.call(a, s), rng);
          if (m === undefined) break;
          const n = a.apply(s, m);
          if (n === null) {
            r.failures += 1;
            stale += 1;
            if (stale > 200) break; // 何をしても進まない
            continue;
          }
          if (seen.has(a.key(n))) {
            stale += 1;
            if (stale > 200) break;
            continue; // 見た局面に戻る手は「やっぱりやめる」扱い
          }
          stale = 0;
          s = n;
          seen.add(a.key(s));
          r.moves += 1;
          if (r.moves >= b.maxMovesPerAttempt * (attempt + 1)) break;
        }
        if (a.isCleared(s)) {
          r.solved = true;
          return r;
        }
      }
      return r;
    },
  };
}

/**
 * 貪欲: progress が最大になる手を選ぶ（同点はランダム）。訪れた局面へは戻らない。
 * sideways=false なら、良くならない手しか無いとき詰みとして最初から。
 */
export function greedy(b: Budget & { sideways: boolean }, id = "greedy"): Player {
  return {
    id,
    aid: true,
    play(a, rng) {
      const r: PlayResult = { solved: false, moves: 0, failures: 0, restarts: 0, undos: 0 };
      const prog = a.progress ?? (() => 0);
      for (let attempt = 0; attempt < b.maxAttempts; attempt += 1) {
        if (attempt > 0) r.restarts += 1;
        let s = a.initial;
        let cur = prog(s);
        const seen = new Set([a.key(s)]);
        for (let i = 0; i < b.maxMovesPerAttempt; i += 1) {
          if (a.isCleared(s)) break;
          let best: (typeof s)[] = [];
          let bestScore = Number.NEGATIVE_INFINITY;
          for (const m of a.legalMoves(s)) {
            const n = a.apply(s, m);
            if (n === null || seen.has(a.key(n))) continue;
            const sc = a.isCleared(n) ? Number.POSITIVE_INFINITY : prog(n);
            if (sc > bestScore) {
              bestScore = sc;
              best = [n];
            } else if (sc === bestScore) best.push(n);
          }
          const n = pick(best, rng);
          if (!n) break;
          if (!b.sideways && bestScore < cur) break;
          s = n;
          cur = bestScore;
          seen.add(a.key(s));
          r.moves += 1;
        }
        if (a.isCleared(s)) {
          r.solved = true;
          return r;
        }
      }
      return r;
    },
  };
}

/**
 * 試し置きして戻す: progress の良い順に手を試す深さ優先。行き詰まったら1手戻す（やり直し1回）。
 * 戻す回数に上限を置き、超えたら諦める。
 */
export function greedyBacktrack(b: { undoBudget: number; maxMoves: number }, id = "backtrack"): Player {
  return {
    id,
    aid: true,
    play(a, rng) {
      const r: PlayResult = { solved: false, moves: 0, failures: 0, restarts: 0, undos: 0 };
      const prog = a.progress ?? (() => 0);
      type Frame = { s: (typeof a)["initial"]; children: (typeof a)["initial"][] };
      const seen = new Set<string>();
      const order = (s: (typeof a)["initial"]) => {
        const xs: { n: (typeof a)["initial"]; sc: number; t: number }[] = [];
        for (const m of a.legalMoves(s)) {
          const n = a.apply(s, m);
          if (n === null || seen.has(a.key(n))) continue;
          xs.push({ n, sc: a.isCleared(n) ? Number.POSITIVE_INFINITY : prog(n), t: rng() });
        }
        xs.sort((p, q) => q.sc - p.sc || p.t - q.t);
        // 同じ子を重複して持たない
        const keys = new Set<string>();
        return xs.filter((x) => {
          const k = a.key(x.n);
          if (keys.has(k)) return false;
          keys.add(k);
          return true;
        }).map((x) => x.n).reverse(); // pop で良い順
      };
      seen.add(a.key(a.initial));
      const stack: Frame[] = [{ s: a.initial, children: order(a.initial) }];
      while (stack.length > 0) {
        const top = stack[stack.length - 1]!;
        if (a.isCleared(top.s)) {
          r.solved = true;
          return r;
        }
        if (r.moves >= b.maxMoves) return r;
        let next: (typeof a)["initial"] | undefined;
        while (top.children.length > 0) {
          const c = top.children.pop()!;
          if (!seen.has(a.key(c))) {
            next = c;
            break;
          }
        }
        if (next === undefined) {
          stack.pop();
          if (stack.length === 0) return r;
          r.undos += 1;
          if (r.undos > b.undoBudget) return r;
          continue;
        }
        seen.add(a.key(next));
        r.moves += 1;
        stack.push({ s: next, children: order(next) });
      }
      return r;
    },
  };
}

export type Summary = {
  game: string;
  version: string;
  level: string;
  player: string;
  n: number;
  solveRate: number;
  firstTryRate: number;
  movesMedian: number;
  moveRatioMedian: number;
  failuresMean: number;
  zeroFailureRate: number;
  attemptsMean: number;
  undosMedian: number;
};

function median(xs: number[]): number {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function summarize(
  meta: { game: string; version: string; level: string; player: string },
  results: PlayResult[],
): Summary {
  const solved = results.filter((r) => r.solved);
  return {
    ...meta,
    n: results.length,
    solveRate: solved.length / results.length,
    firstTryRate: solved.filter((r) => r.restarts === 0).length / results.length,
    movesMedian: median(solved.map((r) => r.moves)),
    moveRatioMedian: median(solved.filter((r) => r.minMoves).map((r) => r.moves / r.minMoves!)),
    failuresMean: results.reduce((t, r) => t + r.failures, 0) / results.length,
    zeroFailureRate: results.filter((r) => r.solved && r.failures === 0).length / results.length,
    attemptsMean: results.reduce((t, r) => t + r.restarts + 1, 0) / results.length,
    undosMedian: median(results.map((r) => r.undos)),
  };
}

export function runLevel<P, S, M>(
  meta: { game: string; version: string; level: string },
  problems: P[],
  toAdapter: (p: P) => Adapter<S, M>,
  players: Player[],
  playsPerProblem: number,
): Summary[] {
  const out: Summary[] = [];
  const adapters = problems.map(toAdapter);
  for (const pl of players) {
    const results: PlayResult[] = [];
    adapters.forEach((a, i) => {
      for (let k = 0; k < playsPerProblem; k += 1) {
        const r = pl.play(a, makeRng(`${meta.game}:${meta.version}:${meta.level}:${pl.id}:${i}:${k}`));
        r.minMoves = a.minMoves;
        results.push(r);
      }
    });
    out.push(summarize({ ...meta, player: pl.id }, results));
  }
  return out;
}

/** 等間隔に n 件を抜き出す（問題集の並びの偏りを避ける）。 */
export function sampleEvenly<T>(xs: readonly T[], n: number): T[] {
  if (xs.length <= n) return [...xs];
  return Array.from({ length: n }, (_, i) => xs[Math.floor((i * xs.length) / n)]!);
}

export function fmt(s: Summary): string {
  const p = (x: number) => (Number.isNaN(x) ? "-" : `${Math.round(x * 100)}%`);
  const f = (x: number) => (Number.isNaN(x) ? "-" : x.toFixed(1));
  return `| ${s.game} | ${s.version} | ${s.level} | ${s.player} | ${s.n} | ${p(s.firstTryRate)} | ${p(s.solveRate)} | ${p(s.zeroFailureRate)} | ${f(s.movesMedian)} | ${Number.isNaN(s.moveRatioMedian) ? "-" : s.moveRatioMedian.toFixed(2)} | ${f(s.failuresMean)} | ${f(s.attemptsMean)} | ${f(s.undosMedian)} |`;
}

export const tableHeader =
  "| game | version | level | player | plays | solved 1st try | solved (all tries) | solved w/o failure | moves(med, solved) | moves/min(med, solved) | failures(mean) | attempts(mean) | undos(med) |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|";

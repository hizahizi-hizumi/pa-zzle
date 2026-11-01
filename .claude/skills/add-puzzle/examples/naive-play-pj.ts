// パーキングジャム: 陽性 origin/main（challenge-levers-v1。PR #457 の前と同じ問題集）と、作り直し案 PR #457 head c7024212（dependency-choice-v2）
import {
  type Adapter,
  fmt,
  randomBlind,
  randomLegal,
  runLevel,
  sampleEvenly,
  type Summary,
  tableHeader,
} from "../scripts/naive-play-core.ts";

type S = { remainingVehicleIds: readonly string[] };
type M = { vehicleId: string; direction: "up" | "right" | "down" | "left" };

const N = Number(process.env.N ?? 30);
const PLAYS = Number(process.env.PLAYS ?? 5);

const versions = [
  { name: "pos main(challenge-levers-v1)", root: "/tmp/naive/main/frontend/src/games/parking-jam" },
  { name: "after #457 head(dependency-choice-v2)", root: "/tmp/naive/pj-new/frontend/src/games/parking-jam" },
];

const out: Summary[] = [];
const extra: string[] = [];

for (const v of versions) {
  const rules = await import(`${v.root}/puzzle/rules.ts`);
  const boardMod = await import(`${v.root}/puzzle/board.ts`);
  const pool = await import(`${v.root}/problem/problem-pool.ts`);
  const gen = await import(`${v.root}/problem/generator.ts`);
  for (const level of [1, 2, 3, 4, 5]) {
    const t0 = Date.now();
    const entries = sampleEvenly(pool.listParkingJamPoolEntries(level), N);
    // biome-ignore lint: any
    const boards: any[] = entries.map(
      (e: unknown) => gen.restoreParkingJamProblemWithoutAnalysis(pool.toParkingJamPoolIdentity(e)).problem.board,
    );
    // biome-ignore lint: any
    const axisMoves = (board: any, s: S, wallAware: boolean): M[] => {
      const ms: M[] = [];
      for (const id of s.remainingVehicleIds) {
        // biome-ignore lint: any
        const veh = board.vehicles.find((x: any) => x.id === id);
        const dirs: M["direction"][] = veh.orientation === "horizontal" ? ["left", "right"] : ["up", "down"];
        for (const d of dirs) {
          const m = { vehicleId: id, direction: d };
          if (wallAware) {
            const bl = rules.listParkingJamMoveBlockers(board, s, m);
            if (bl.some((b: { kind: string }) => b.kind === "wall")) continue;
          }
          ms.push(m);
        }
      }
      return ms;
    };
    // biome-ignore lint: any
    const adapter = (wallAware: boolean) => (board: any): Adapter<S, M> => ({
      initial: boardMod.createParkingJamInitialState(board),
      minMoves: board.vehicles.length,
      legalMoves: (s) => rules.listParkingJamLegalMoves(board, s),
      blindMoves: (s) => axisMoves(board, s, wallAware),
      apply: (s, m) => rules.applyParkingJamMove(board, s, m),
      isCleared: (s) => s.remainingVehicleIds.length === 0,
      key: (s) => [...s.remainingVehicleIds].sort().join(","),
      progress: (s) => -s.remainingVehicleIds.length,
    });
    const budget = { maxMovesPerAttempt: 100, maxAttempts: 1 };
    const meta = { game: "parking-jam", version: v.name, level: String(level) };
    out.push(...runLevel(meta, boards, adapter(false), [randomBlind(budget, "blind-random(no reading)")], PLAYS));
    out.push(...runLevel(meta, boards, adapter(true), [randomBlind(budget, "blind-wall-aware(sees exits only)")], PLAYS));
    out.push(...runLevel(meta, boards, adapter(false), [randomLegal(budget, "random-legal(reads paths)")], PLAYS));

    // 合法な車の割合（今出せる車 / 残りの車）を、ランダムな合法手順に沿って平均する
    let sumFrac = 0;
    let steps = 0;
    let minFracSum = 0;
    let carCount = 0;
    for (const board of boards) {
      carCount += board.vehicles.length;
      let s: S = boardMod.createParkingJamInitialState(board);
      let minFrac = 1;
      let k = 0;
      while (s.remainingVehicleIds.length > 0) {
        const legal = rules.listParkingJamLegalMoves(board, s) as M[];
        const cars = new Set(legal.map((m) => m.vehicleId));
        const frac = cars.size / s.remainingVehicleIds.length;
        sumFrac += frac;
        minFrac = Math.min(minFrac, frac);
        steps += 1;
        const m = legal[(k * 7919) % legal.length]!;
        k += 1;
        s = rules.applyParkingJamMove(board, s, m);
      }
      minFracSum += minFrac;
    }
    extra.push(
      `| ${v.name} | ${level} | ${(carCount / boards.length).toFixed(1)} | ${(sumFrac / steps).toFixed(2)} | ${(minFracSum / boards.length).toFixed(2)} |`,
    );
    console.error(`${v.name} ${level} ${Date.now() - t0}ms`);
  }
}

console.log(tableHeader);
for (const s of out) console.log(fmt(s));
console.log("\n| version | level | cars(mean) | legal-car fraction (mean over steps) | min legal-car fraction (mean over problems) |\n|---|---|---|---|---|");
for (const e of extra) console.log(e);

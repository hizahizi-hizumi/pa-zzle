import { countMagicSquareSolutions } from "@/games/magic-square/problem/generation/solver";
import reference from "@/games/magic-square/problem/generation/research-reference.json";
let t = performance.now();
const all = countMagicSquareSolutions(4, Array(16).fill(0), { limit: Number.POSITIVE_INFINITY, nodeCap: null, collect: true });
console.log("all4", all.count, all.nodes, Math.round(performance.now() - t), "ms");
t = performance.now();
let bad = 0;
for (const c of reference.solver) {
  const r = countMagicSquareSolutions(c.n, c.givens, { limit: c.limit, nodeCap: c.nodeCap });
  if (r.count !== c.count || r.nodes !== c.nodes || r.capped !== c.capped) { bad++; console.log("mismatch", c.id, r.count, r.nodes, r.capped, "expected", c.count, c.nodes, c.capped); }
}
console.log("solver cases", reference.solver.length, "mismatch", bad, Math.round(performance.now() - t), "ms");

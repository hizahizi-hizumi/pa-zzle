import { execSync } from "node:child_process";
const out = execSync("node search.mjs", { env: { ...process.env } }) && execSync("node search.mjs", { maxBuffer: 1 << 26 }).toString().split("\n").filter((l) => l.includes("| a"));
const allLines = [[0,1,2,3],[4,5,6,7],[8,9,10,11],[12,13,14,15],[0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15],[0,5,10,15],[3,6,9,12]];
let n = 0;
for (const l of out) {
  const grid = l.split("|")[0].trim().split("/").flatMap((r) => r.trim().split(/\s+/));
  const givens = grid.map((v) => v !== ".");
  if (allLines.some((line) => line.every((c) => givens[c]))) continue;
  n += 1;
  console.log(l);
}
console.log("no full-given line:", n);

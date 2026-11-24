import { execSync } from "node:child_process";
const out = execSync("node search.mjs", { maxBuffer: 1 << 26 }).toString().split("\n").filter((l) => l.includes("| a"));
const groups = new Map();
for (const l of out) { const k = l.split("|")[0].trim(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(l.split("|").slice(1).join("|")); }
console.log("sets", groups.size);
for (const [k, v] of groups) console.log(k, "  (", v.length, ")\n   ", v.filter((x) => /s5 .*:row.*:column|s5 .*:column.*:row|s5 .*:diagonal/.test(x))[0] ?? v[0]);

#!/usr/bin/env node
// Check synthetic fixtures against their independently recorded behavioral contracts.
// The oracle belongs to the evaluator; it must never be passed to a review agent.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const quality = join(here, '../../review-quality/evals');
const cases = JSON.parse(readFileSync(join(quality, 'cases.json'), 'utf8'));
const oracles = JSON.parse(readFileSync(join(quality, 'oracle-cases.json'), 'utf8'));
const byId = new Map(cases.map((c) => [c.id, c]));
const report = [];
for (const [id, oracle] of Object.entries(oracles)) {
  const entry = byId.get(id);
  if (!entry || entry.scoring !== 'primary' || entry.kind !== 'synthetic') throw new Error(`Invalid oracle case: ${id}`);
  const source = stripTypeScriptTypes(entry.content).replace(/\bexport\s+/g, '');
  const context = vm.createContext({});
  const action = vm.runInContext(`${source}\n; ${oracle.function}`, context, { timeout: 1000 });
  if (typeof action !== 'function') throw new Error(`${id}: missing callable ${oracle.function}`);
  let failures = 0;
  let observations = 0;
  for (const test of oracle.checks) {
    const args = structuredClone(test.args);
    const inputSnapshot = JSON.stringify(args);
    const actual = action(...args);
    const outputOk = JSON.stringify(actual) === JSON.stringify(test.expected);
    const mutationOk = !test.inputs_unchanged || JSON.stringify(args) === inputSnapshot;
    observations++;
    if (!outputOk || !mutationOk) failures++;
  }
  report.push({ id, observations, violations: failures });
}
for (const [name, count] of [['BEFORE',1], ['AFTER',0]]) {
  const rows = report.filter((r) => r.id.endsWith(name));
  if (rows.length < 3) throw new Error(`Not enough ${name} cases: ${rows.length}`);
  for (const r of rows) {
    if (name === 'BEFORE' && r.violations < count) throw new Error(`${r.id}: missing intended defect`);
    if (name === 'AFTER' && r.violations !== count) throw new Error(`${r.id}: invalid negative control`);
  }
}
process.stdout.write(JSON.stringify({ cases: report.length, report }, null, 2) + '\n');

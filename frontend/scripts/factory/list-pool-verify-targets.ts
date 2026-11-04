import { readdirSync } from "node:fs";
import path from "node:path";

import { findRepositoryRoot, readChangedFiles } from "./git-changes";
import { listPoolVerifyTargets } from "./pool-verify-targets";
import { parseRevisionRangeArguments } from "./revision-range-arguments";

const { range } = parseRevisionRangeArguments(process.argv.slice(2), {});
const repositoryRoot = findRepositoryRoot();
const targets = listPoolVerifyTargets(
  readChangedFiles(repositoryRoot, range),
  readdirSync(path.join(repositoryRoot, "frontend/scripts")),
);

for (const game of targets.gamesWithoutScript) {
  process.stderr.write(
    `${game}: 問題の生成・プールが変わったが、問題集の生成スクリプトが無いので --verify を飛ばす\n`,
  );
}
for (const game of targets.games) {
  process.stdout.write(`${game}\n`);
}

import { writeFileSync } from "node:fs";

import {
  renderChangeClassificationMarkdown,
  treatmentLabels,
} from "./change-treatment";
import { classifyRevisionRange, findRepositoryRoot } from "./git-changes";
import { parseRevisionRangeArguments } from "./revision-range-arguments";

const { range, values } = parseRevisionRangeArguments(process.argv.slice(2), {
  json: { type: "string" },
});
const classification = classifyRevisionRange(findRepositoryRoot(), range);

if (values.json !== undefined) {
  writeFileSync(
    values.json,
    `${JSON.stringify(
      {
        ...classification,
        treatmentLabel: treatmentLabels[classification.treatment],
      },
      null,
      2,
    )}\n`,
  );
}
process.stdout.write(renderChangeClassificationMarkdown(classification));

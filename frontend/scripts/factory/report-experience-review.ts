import {
  loadIdentifiedDocuments,
  productDocumentsDirectory,
} from "./document-ids";
import {
  collectReferencedIds,
  isRequirementReferenceSource,
  renderExperienceReviewMarkdown,
} from "./experience-review";
import {
  classifyRevisionRange,
  findRepositoryRoot,
  readFileAtRevision,
  resolveMergeBase,
} from "./git-changes";
import type { SourceFile } from "./requirement-trace";
import { parseRevisionRangeArguments } from "./revision-range-arguments";

const { range, values } = parseRevisionRangeArguments(process.argv.slice(2), {
  "e2e-artifact-url": { type: "string" },
});
const repositoryRoot = findRepositoryRoot();
const classification = classifyRevisionRange(repositoryRoot, range);
const mergeBase = resolveMergeBase(repositoryRoot, range);

const changedReferenceSources: SourceFile[] = classification.files.flatMap(
  (file) => {
    if (
      !isRequirementReferenceSource(file.path) &&
      (file.previousPath === undefined ||
        !isRequirementReferenceSource(file.previousPath))
    ) {
      return [];
    }
    const text =
      file.status === "deleted"
        ? readFileAtRevision(repositoryRoot, mergeBase, file.path)
        : readFileAtRevision(repositoryRoot, range.head, file.path);
    return text === null ? [] : [{ path: file.path, text }];
  },
);

const e2eArtifactUrl = values["e2e-artifact-url"];
process.stdout.write(
  renderExperienceReviewMarkdown({
    classification,
    referencedIds: collectReferencedIds(
      changedReferenceSources,
      loadIdentifiedDocuments(repositoryRoot, productDocumentsDirectory),
    ),
    e2eArtifactUrl:
      e2eArtifactUrl === undefined || e2eArtifactUrl === ""
        ? null
        : e2eArtifactUrl,
  }),
);

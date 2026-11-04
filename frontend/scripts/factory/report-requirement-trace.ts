import {
  loadIdentifiedDocuments,
  productDocumentsDirectory,
} from "./document-ids";
import { findRepositoryRoot } from "./git-changes";
import {
  buildRequirementTrace,
  loadVerificationFiles,
  renderRequirementTraceMarkdown,
} from "./requirement-trace";

const repositoryRoot = findRepositoryRoot();

process.stdout.write(
  renderRequirementTraceMarkdown(
    buildRequirementTrace(
      loadIdentifiedDocuments(repositoryRoot, productDocumentsDirectory),
      loadVerificationFiles(repositoryRoot),
    ),
  ),
);

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  type ChangeClassification,
  classifyChanges,
  type FileChange,
  frontendPackageManifestPath,
  parseNameStatusOutput,
} from "./change-treatment";

/** 比べる2点。head が null のときは作業ツリー（未追跡のファイルを含む）と比べる。 */
export type RevisionRange = {
  base: string;
  head: string | null;
};

export function findRepositoryRoot(): string {
  return runGit(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
}

/** PR と同じく、base と head の merge-base から head までの変更を読む。 */
export function readChangedFiles(
  repositoryRoot: string,
  range: RevisionRange,
): FileChange[] {
  if (range.head !== null) {
    return parseNameStatusOutput(
      runGit(repositoryRoot, [
        "diff",
        "--name-status",
        "-M",
        "-z",
        `${range.base}...${range.head}`,
      ]),
    );
  }
  const mergeBase = resolveMergeBase(repositoryRoot, range);
  const trackedChanges = parseNameStatusOutput(
    runGit(repositoryRoot, ["diff", "--name-status", "-M", "-z", mergeBase]),
  );
  const untrackedChanges = runGit(repositoryRoot, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ])
    .split("\0")
    .filter((filePath) => filePath !== "")
    .map((filePath): FileChange => ({ status: "added", path: filePath }));
  return [...trackedChanges, ...untrackedChanges];
}

export function resolveMergeBase(
  repositoryRoot: string,
  range: RevisionRange,
): string {
  return runGit(repositoryRoot, [
    "merge-base",
    range.base,
    range.head ?? "HEAD",
  ]).trim();
}

/** revision が null なら作業ツリーから読む。ファイルが無ければ null。 */
export function readFileAtRevision(
  repositoryRoot: string,
  revision: string | null,
  filePath: string,
): string | null {
  if (revision === null) {
    const absolutePath = path.join(repositoryRoot, filePath);
    return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : null;
  }
  try {
    return execFileSync("git", ["show", `${revision}:${filePath}`], {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

export function classifyRevisionRange(
  repositoryRoot: string,
  range: RevisionRange,
): ChangeClassification {
  const mergeBase = resolveMergeBase(repositoryRoot, range);
  return classifyChanges({
    changes: readChangedFiles(repositoryRoot, range),
    frontendPackageManifest: {
      base: readFileAtRevision(
        repositoryRoot,
        mergeBase,
        frontendPackageManifestPath,
      ),
      head: readFileAtRevision(
        repositoryRoot,
        range.head,
        frontendPackageManifestPath,
      ),
    },
  });
}

function runGit(repositoryRoot: string, args: readonly string[]): string {
  return execFileSync("git", ["-c", "core.quotePath=false", ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
}

import { resolve } from "node:path";

import type {
  Rule,
  RuleStatus,
  SourceDocument,
} from "../domain/model.ts";
import { isPathWithin } from "../config/project.ts";

export async function discoverSourceDocuments(options: {
  projectRoot: string;
  rules: Rule[];
  excludePaths: string[];
  requestedPaths: string[];
  statuses?: readonly RuleStatus[];
}): Promise<SourceDocument[]> {
  const {
    projectRoot,
    rules,
    excludePaths,
    requestedPaths,
    statuses = ["active"],
  } = options;
  const allowedStatuses = new Set(statuses);
  const paths = new Set<string>();

  for (const rule of rules) {
    if (!allowedStatuses.has(rule.status)) {
      continue;
    }

    for (const pattern of rule.paths) {
      const glob = new Bun.Glob(pattern);

      for await (const matchedPath of glob.scan({
        cwd: projectRoot,
        onlyFiles: true,
        dot: true,
      })) {
        const projectPath = matchedPath.replaceAll("\\", "/");

        if (
          isExcluded(projectPath, excludePaths) ||
          !isRequested(
            resolve(projectRoot, projectPath),
            requestedPaths,
          )
        ) {
          continue;
        }

        paths.add(projectPath);
      }
    }
  }

  return Promise.all(
    [...paths].sort().map(async (path) => ({
      path,
      source: await Bun.file(resolve(projectRoot, path)).text(),
    })),
  );
}

function isExcluded(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => new Bun.Glob(pattern).match(path));
}

function isRequested(
  absolutePath: string,
  requestedPaths: string[],
): boolean {
  return requestedPaths.some((requestedPath) =>
    isPathWithin(requestedPath, absolutePath),
  );
}

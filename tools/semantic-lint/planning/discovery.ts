import { resolve } from "node:path";

import type { Rule, SourceDocument } from "../domain/model.ts";
import { isPathWithin } from "../config/project.ts";

export async function discoverSourceDocuments(options: {
  projectRoot: string;
  rules: Rule[];
  excludePaths: string[];
  requestedPaths: string[];
}): Promise<SourceDocument[]> {
  const { projectRoot, rules, excludePaths, requestedPaths } = options;
  const paths = new Set<string>();

  for (const rule of rules) {
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

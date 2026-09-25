import { resolve } from "node:path";

import type { Rule, SourceDocument } from "../domain/model.ts";
import { isPathWithin } from "../config/project.ts";
import { matchesAnyGlob } from "./planner.ts";

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
          matchesAnyGlob(excludePaths, projectPath) ||
          matchesAnyGlob(rule.exclude, projectPath) ||
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

function isRequested(
  absolutePath: string,
  requestedPaths: string[],
): boolean {
  return requestedPaths.some((requestedPath) =>
    isPathWithin(requestedPath, absolutePath),
  );
}

import { stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const CONFIG_PATH = ".semantic-lint/config.yaml";

export async function findProjectRoot(start = process.cwd()): Promise<string> {
  let current = resolve(start);

  while (true) {
    if (await exists(resolve(current, CONFIG_PATH))) {
      return current;
    }

    const parent = dirname(current);

    if (parent === current) {
      throw new Error(
        `${CONFIG_PATH} が見つかりません。リポジトリ内から実行してください。`,
      );
    }

    current = parent;
  }
}

export async function resolveRequestedPaths(
  projectRoot: string,
  paths: string[],
): Promise<string[]> {
  const requested = paths.length > 0 ? paths : ["."];
  const resolvedPaths: string[] = [];

  for (const path of requested) {
    const absolutePath = resolve(process.cwd(), path);

    if (!isPathWithin(projectRoot, absolutePath)) {
      throw new Error(`リポジトリ外のパスは指定できません: ${path}`);
    }

    if (!(await exists(absolutePath))) {
      throw new Error(`指定されたパスが存在しません: ${path}`);
    }

    resolvedPaths.push(absolutePath);
  }

  return resolvedPaths;
}

export function isPathWithin(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child);

  return (
    pathFromParent === "" ||
    (pathFromParent !== ".." &&
      !pathFromParent.startsWith(`..${sep}`) &&
      !isAbsolute(pathFromParent))
  );
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

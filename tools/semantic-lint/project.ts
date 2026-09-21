import { stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const CONFIG_PATH = ".semantic-lint/config.json";

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

export async function resolveScopes(
  projectRoot: string,
  args: string[],
): Promise<string[]> {
  const rawScopes = args.length > 0 ? args : ["."];
  const scopes: string[] = [];

  for (const scope of rawScopes) {
    const absolutePath = resolve(process.cwd(), scope);

    if (!isPathWithin(projectRoot, absolutePath)) {
      throw new Error(`リポジトリ外のパスは指定できません: ${scope}`);
    }

    try {
      await stat(absolutePath);
    } catch {
      throw new Error(`指定されたパスが存在しません: ${scope}`);
    }

    scopes.push(absolutePath);
  }

  return scopes;
}

export function isInScopes(absolutePath: string, scopes: string[]): boolean {
  return scopes.some((scope) => isPathWithin(scope, absolutePath));
}

function isPathWithin(parent: string, child: string): boolean {
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

import {
  decisionCachePath,
  FileDecisionCache,
} from "../cache/decision-cache.ts";

export async function openDecisionCache(
  projectRoot: string,
  enabled: boolean,
): Promise<FileDecisionCache | undefined> {
  return enabled
    ? FileDecisionCache.open(decisionCachePath(projectRoot))
    : undefined;
}

/** cacheの保存失敗はlint結果に影響させず、警告だけを出す。 */
export async function closeDecisionCache(
  cache: FileDecisionCache | undefined,
): Promise<void> {
  if (!cache) {
    return;
  }

  if (cache.writeError !== undefined) {
    warn(cache.writeError);
  }

  try {
    await cache.compact();
  } catch (error) {
    warn(error);
  }
}

function warn(error: unknown): void {
  console.error(
    `WARN 判定cacheを保存できませんでした: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}

import type { FileChange } from "./change-treatment";

export type PoolVerifyTargets = {
  /** `--verify` を実行するゲーム */
  games: string[];
  /** 問題の生成・プールが変わったが、生成スクリプトが無いゲーム */
  gamesWithoutScript: string[];
};

const problemDirectoryPattern = /^frontend\/src\/games\/([^/]+)\/problem\//;

export function poolScriptFileName(game: string): string {
  return `generate-${game}-problem-pool.ts`;
}

export function listPoolVerifyTargets(
  changes: readonly FileChange[],
  poolScriptFileNames: readonly string[],
): PoolVerifyTargets {
  const changedGames = new Set(
    changes.flatMap((change) =>
      [change.path, change.previousPath].flatMap((filePath) => {
        const game =
          filePath === undefined
            ? undefined
            : problemDirectoryPattern.exec(filePath)?.[1];
        return game === undefined ? [] : [game];
      }),
    ),
  );
  const availableScripts = new Set(poolScriptFileNames);
  const sortedGames = [...changedGames].sort();
  return {
    games: sortedGames.filter((game) =>
      availableScripts.has(poolScriptFileName(game)),
    ),
    gamesWithoutScript: sortedGames.filter(
      (game) => !availableScripts.has(poolScriptFileName(game)),
    ),
  };
}

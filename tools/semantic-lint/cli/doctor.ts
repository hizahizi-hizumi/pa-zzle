import { relative, resolve } from "node:path";

import {
  decisionCachePath,
  inspectDecisionCacheFile,
  type DecisionCacheFileStatus,
} from "../cache/decision-cache.ts";

import { createDefaultScopeRegistry } from "../scopes/default.ts";
import { loadProjectContext } from "./context.ts";

export async function runDoctorCommand(args: string[]): Promise<number> {
  if (args.length > 0) {
    throw new Error("doctorに引数は指定できません。");
  }

  const { projectRoot, config, rules } = await loadProjectContext();
  const scopes = await createDefaultScopeRegistry(projectRoot);
  const errors: string[] = [];
  const warnings: string[] = [];
  const sourceCache = new Map<string, string>();

  for (const rule of rules) {
    if (!scopes.has(rule.scope)) {
      errors.push(`${rule.id}: 未登録scope ${rule.scope}`);
    }

    const sourcePath = resolve(projectRoot, rule.source.path);
    let source = sourceCache.get(sourcePath);

    if (source === undefined) {
      const file = Bun.file(sourcePath);

      if (!(await file.exists())) {
        errors.push(`${rule.id}: 規約sourceが存在しません: ${rule.source.path}`);
        continue;
      }

      source = await file.text();
      sourceCache.set(sourcePath, source);
    }

    if (!hasHeadingPath(source, rule.source.section)) {
      errors.push(
        `${rule.id}: 規約sectionが見つかりません: ${rule.source.section}`,
      );
    }
  }

  if (!process.env[config.provider.apiKeyEnv]) {
    warnings.push(
      `provider環境変数が未設定です: ${config.provider.apiKeyEnv}`,
    );
  }

  const cacheStatus = await inspectDecisionCacheFile(
    decisionCachePath(projectRoot),
  );

  if (cacheStatus.invalidLines > 0) {
    warnings.push(
      `判定cacheに読めない行があります（missとして扱い、次回実行時に削除します）: ${cacheStatus.invalidLines}行`,
    );
  }

  console.log(`rules: ${rules.length}`);
  console.log(`scopes: ${scopes.ids().join(", ")}`);
  console.log(`cache: ${describeCache(projectRoot, cacheStatus)}`);
  console.log(`errors: ${errors.length}`);
  console.log(`warnings: ${warnings.length}`);

  for (const error of errors) {
    console.log(`ERROR ${error}`);
  }

  for (const warning of warnings) {
    console.log(`WARN  ${warning}`);
  }

  return errors.length > 0 ? 2 : 0;
}

function describeCache(
  projectRoot: string,
  status: DecisionCacheFileStatus,
): string {
  const path = relative(projectRoot, status.path);

  if (!status.exists) {
    return `${path} (未作成)`;
  }

  const usedRange =
    status.oldestUsedAt && status.newestUsedAt
      ? `, 最終利用 ${status.oldestUsedAt.toISOString()} 〜 ${status.newestUsedAt.toISOString()}`
      : "";

  return `${path} (${status.entries} entries, ${formatBytes(status.bytes)}${usedRange})`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) {
    return `${bytes} B`;
  }

  if (bytes < 1_024 * 1_024) {
    return `${(bytes / 1_024).toFixed(1)} KiB`;
  }

  return `${(bytes / 1_024 / 1_024).toFixed(1)} MiB`;
}

function hasHeadingPath(source: string, section: string): boolean {
  const headings = source
    .split(/\r?\n/)
    .map((line) => /^#{1,6}\s+(.+?)\s*$/.exec(line)?.[1])
    .filter((heading): heading is string => heading !== undefined);
  const segments = section
    .split(">")
    .map((segment) => segment.trim())
    .filter(Boolean);
  let cursor = 0;

  for (const segment of segments) {
    const index = headings.indexOf(segment, cursor);

    if (index === -1) {
      return false;
    }

    cursor = index + 1;
  }

  return true;
}

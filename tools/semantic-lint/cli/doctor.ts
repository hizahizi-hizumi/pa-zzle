import { relative } from "node:path";

import {
  decisionCachePath,
  inspectDecisionCacheFile,
  type DecisionCacheFileStatus,
} from "../cache/decision-cache.ts";

import type { Rule } from "../domain/model.ts";
import { goldenFileStatus, loadGoldenSets } from "../eval/golden.ts";
import { matchesAnyGlob } from "../planning/planner.ts";
import type { UnitCatalog } from "../units/catalog.ts";
import { UnitExtractor } from "../units/extract.ts";
import { loadEvalRules, loadProjectContext } from "./context.ts";

export async function runDoctorCommand(args: string[]): Promise<number> {
  if (args.length > 0) {
    throw new Error("doctorに引数は指定できません。");
  }

  const context = await loadProjectContext();
  const { projectRoot, config, catalog, rules } = context;
  const evalRules = await loadEvalRules(context);
  // 全言語の文法を読み込み全queryをcompileして、カタログの誤りを検出する。
  await UnitExtractor.create(catalog);
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const rule of [...rules, ...evalRules]) {
    warnings.push(
      ...(await unsupportedLanguageWarnings(
        projectRoot,
        catalog,
        rule,
        config.excludePaths,
      )),
    );
  }

  const goldenSets = await loadGoldenSets(projectRoot, config.goldenDir);

  for (const golden of goldenSets) {
    if (![...rules, ...evalRules].some((rule) => rule.id === golden.ruleId)) {
      errors.push(`golden: 未知のruleです: ${golden.ruleId}`);
    }

    for (const file of golden.files) {
      const status = await goldenFileStatus(projectRoot, file);

      if (status !== "current") {
        warnings.push(
          `${golden.ruleId}: goldenのblobとworking treeが異なります (${status}): ${file.path}`,
        );
      }
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
  console.log(`eval rules: ${evalRules.length}`);
  console.log(`units: ${[...catalog.units.keys()].join(", ")}`);
  console.log(`cache: ${describeCache(projectRoot, cacheStatus)}`);
  console.log(`golden: ${goldenSets.length}`);
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

/** ruleの対象fileのうち、言語にunitの定義がなく判定対象を抽出できないものを数える。 */
async function unsupportedLanguageWarnings(
  projectRoot: string,
  catalog: UnitCatalog,
  rule: Rule,
  excludePaths: readonly string[],
): Promise<string[]> {
  const supported = new Set(catalog.languagesFor(rule.unit));
  const unsupported = new Map<string, number>();

  for (const pattern of rule.paths) {
    for await (const path of new Bun.Glob(pattern).scan({
      cwd: projectRoot,
      onlyFiles: true,
    })) {
      if (
        matchesAnyGlob(excludePaths, path) ||
        matchesAnyGlob(rule.exclude, path)
      ) {
        continue;
      }

      const language = catalog.languageFor(path)?.id;

      if (language === undefined || !supported.has(language)) {
        const label = language ?? "未対応の拡張子";
        unsupported.set(label, (unsupported.get(label) ?? 0) + 1);
      }
    }
  }

  return [...unsupported].map(
    ([language, count]) =>
      `${rule.id}: unit ${rule.unit} は ${language} に定義がないため、${count}件のfileから判定対象を抽出できません`,
  );
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

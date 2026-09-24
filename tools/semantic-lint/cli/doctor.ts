import { resolve } from "node:path";

import { goldenFileStatus, loadGoldenSets } from "../eval/golden.ts";
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

  const goldenSets = await loadGoldenSets(projectRoot, config.goldenDir);

  for (const golden of goldenSets) {
    if (!rules.some((rule) => rule.id === golden.ruleId)) {
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

  console.log(`rules: ${rules.length}`);
  console.log(`scopes: ${scopes.ids().join(", ")}`);
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

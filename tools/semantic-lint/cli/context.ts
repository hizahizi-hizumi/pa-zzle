import { loadSemanticLintConfig } from "../config/config.ts";
import { findProjectRoot } from "../config/project.ts";
import { loadRulesets } from "../config/ruleset.ts";
import { loadUnitCatalog } from "../units/catalog.ts";

export async function loadProjectContext() {
  const projectRoot = await findProjectRoot();
  const config = await loadSemanticLintConfig(projectRoot);
  const catalog = await loadUnitCatalog();
  const rules = await loadRulesets(
    projectRoot,
    config.rulesDir,
    new Set(catalog.units.keys()),
  );

  return {
    projectRoot,
    config,
    catalog,
    rules,
  };
}

/**
 * 評価専用rulesetのrule。`bench` と `doctor` だけが使う。
 * 本番のruleとidが重なればエラーにする。
 */
export async function loadEvalRules(
  context: Awaited<ReturnType<typeof loadProjectContext>>,
) {
  const { projectRoot, config, catalog, rules } = context;

  if (config.evalRulesDir === undefined) {
    return [];
  }

  const evalRules = await loadRulesets(
    projectRoot,
    config.evalRulesDir,
    new Set(catalog.units.keys()),
  );
  const ids = new Set(rules.map((rule) => rule.id));

  for (const rule of evalRules) {
    if (ids.has(rule.id)) {
      throw new Error(`評価専用のruleが本番のruleとidが重複しています: ${rule.id}`);
    }
  }

  return evalRules;
}

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

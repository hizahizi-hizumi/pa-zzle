import { loadProjectContext } from "./context.ts";

export async function runRulesCommand(args: string[]): Promise<number> {
  if (args.length > 1) {
    throw new Error("rulesにはprefixを1つまで指定できます。");
  }

  const prefix = args[0];
  const { rules } = await loadProjectContext();
  const selected = prefix
    ? rules.filter(
        (rule) =>
          rule.id === prefix ||
          rule.id.startsWith(prefix + "/") ||
          rule.rulesetId === prefix,
      )
    : rules;

  for (const rule of selected) {
    console.log(
      [
        rule.id,
        rule.status,
        rule.severity,
        `context=${rule.context}`,
        `target=${rule.target}`,
        `threshold=${rule.violationThreshold}`,
        `${rule.source.path}#${rule.source.section}`,
      ].join("\t"),
    );
  }

  return 0;
}

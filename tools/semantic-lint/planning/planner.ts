import type {
  EvaluationPlan,
  EvaluationTask,
  PlannedFile,
  Rule,
  RuleStatus,
  SourceDocument,
  Subject,
} from "../domain/model.ts";
import type { ScopeRegistry } from "../scopes/registry.ts";

export type PathMatcher = (patterns: string[], path: string) => boolean;

export function buildEvaluationPlan(options: {
  documents: SourceDocument[];
  rules: Rule[];
  scopes: ScopeRegistry;
  matchesPath: PathMatcher;
  statuses?: readonly RuleStatus[];
}): EvaluationPlan {
  const {
    documents,
    rules,
    scopes,
    matchesPath,
    statuses = ["active"],
  } = options;
  const allowedStatuses = new Set(statuses);
  const executableRules = rules.filter((rule) =>
    allowedStatuses.has(rule.status),
  );
  const files: PlannedFile[] = [];

  for (const document of [...documents].sort((a, b) =>
    a.path.localeCompare(b.path),
  )) {
    const matchingRules = executableRules.filter((rule) =>
      matchesPath(rule.paths, document.path),
    );

    if (matchingRules.length === 0) {
      continue;
    }

    const subjectsBySelection = new Map<string, Subject[]>();
    const subjects: Subject[] = [];
    const tasks: EvaluationTask[] = [];

    for (const rule of matchingRules.sort((a, b) => a.id.localeCompare(b.id))) {
      const selectionKey = `${rule.context}\0${rule.target}`;
      let selectedSubjects = subjectsBySelection.get(selectionKey);

      if (!selectedSubjects) {
        selectedSubjects = scopes.extract(rule.context, rule.target, document);
        subjectsBySelection.set(selectionKey, selectedSubjects);
        subjects.push(...selectedSubjects);
      }

      for (const subject of selectedSubjects) {
        tasks.push({
          id: taskId(rule.id, subject.id),
          ruleId: rule.id,
          subjectId: subject.id,
        });
      }
    }

    files.push({
      path: document.path,
      source: document.source,
      subjects: dedupeSubjects(subjects),
      tasks,
    });
  }

  return { files };
}

export function bunGlobPathMatcher(patterns: string[], path: string): boolean {
  return patterns.some((pattern) => new Bun.Glob(pattern).match(path));
}

function taskId(ruleId: string, subjectId: string): string {
  return `${ruleId}::${subjectId}`;
}

function dedupeSubjects(subjects: Subject[]): Subject[] {
  const byId = new Map<string, Subject>();

  for (const subject of subjects) {
    byId.set(subject.id, subject);
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

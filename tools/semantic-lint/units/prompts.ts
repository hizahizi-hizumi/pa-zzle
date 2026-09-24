import type { Predicate } from "../domain/model.ts";
import type { ChoiceQuestion } from "../providers/choice.ts";
import { type LocateWindow, windowCriteria } from "./locate.ts";
import type { Unit, UnitDocument } from "./model.ts";

/** 複数の質問が共有するstate。質問が参照する単位と文脈だけを含める。 */
export function buildUnitState(
  document: UnitDocument,
  units: readonly Unit[],
  unitKeys: ReadonlyMap<string, string>,
): unknown {
  const contextIds = new Set(units.flatMap((unit) => unit.contextIds));

  return {
    path: document.path,
    outline: document.outline,
    contexts: Object.fromEntries(
      document.contexts
        .filter((context) => contextIds.has(context.id))
        .map((context) => [
          context.id,
          { description: context.description, source: context.source },
        ]),
    ),
    units: Object.fromEntries(
      units.map((unit) => [
        unitKeys.get(unit.id) ?? unit.id,
        {
          kind: unit.kind,
          lines: `${unit.span.startLine}-${unit.span.endLine}`,
          context: unit.contextIds,
          source: unit.source,
        },
      ]),
    ),
  };
}

export function judgeQuestion(options: {
  unit: Unit;
  unitKey: string;
  unitDescription: string;
  predicate: Predicate;
}): ChoiceQuestion {
  const { unit, unitKey, unitDescription, predicate } = options;

  return {
    instructions: [
      `Classification target: state.units.${unitKey}, ${unitDescription}, at lines ${unit.span.startLine}-${unit.span.endLine} of state.path.`,
      "Judge only this target. state.outline and the state.contexts listed in the target's context field are surrounding evidence. Other entries in state.units are not the target.",
      "Code nested inside the target is part of the target; nested functions are also judged separately as their own targets.",
      "Classify the target as a whole according to what the criteria describe. If the criteria concern a different kind of code than the target itself, choose not_applicable.",
      "",
      predicate.instruction,
    ].join("\n"),
    criteria: predicate.outcomes,
  };
}

export function locateQuestion(options: {
  unit: Unit;
  unitKey: string;
  predicate: Predicate;
  window: LocateWindow;
}): ChoiceQuestion {
  const { unit, unitKey, predicate, window } = options;

  return {
    instructions: [
      `state.units.${unitKey} (lines ${unit.span.startLine}-${unit.span.endLine} of state.path) was judged to violate the rule below.`,
      `Choose the line of state.units.${unitKey} where the violation appears. Each choice is a line ID (L<line number>) followed by that line's code.`,
      "If several lines violate the rule, choose the one that shows the violation most directly.",
      ...(window.allowsNone
        ? [
            "Only part of the target's lines are listed. Choose NONE when none of the listed lines shows the violation.",
          ]
        : []),
      "",
      "Rule:",
      predicate.instruction.trim(),
      "",
      "Violation:",
      predicate.outcomes.violation.trim(),
    ].join("\n"),
    criteria: windowCriteria(window),
  };
}

import type { Unit } from "./model.ts";
import { isLocatableLine, type LineSpan } from "./syntax.ts";

/** providerのchoiceが受け付ける選択肢の上限。 */
export const MAX_CHOICES = 255;
export const NONE_CHOICE = "NONE";

/**
 * - lines: 位置特定の候補を行IDにする。複数行の文は行ごとの確率を合算する。
 * - statements: 位置特定の候補を文の先頭行IDにする。
 * - judge: 違反単位の中の文ごとに、違反の一部かどうかを別々に判定する。
 */
export const LOCATE_MODES = ["lines", "statements", "judge"] as const;
export type LocateMode = (typeof LOCATE_MODES)[number];

/**
 * 1つの違反単位に複数の違反箇所があると確率が分散するため、
 * 最有力候補に対する比率と絶対値の両方を満たす候補を指摘する。
 */
export const LOCATE_RELATIVE_SHARE = 0.3;
export const LOCATE_MIN_SHARE = 0.1;
/** judgeで文を違反の一部とみなす確率。 */
export const STATEMENT_VIOLATION_PROBABILITY = 0.5;

const CHOICE_TEXT_LENGTH = 160;

export type LocateCandidate = {
  key: string;
  text: string;
  target: LineSpan;
};

/** 1つのchoice質問で扱う候補。上限を超える単位は複数のwindowに分ける。 */
export type LocateWindow = {
  candidates: LocateCandidate[];
  allowsNone: boolean;
};

/** 違反単位1つぶんの位置特定の質問。choiceはwindow、judgeは文ごとに1つ。 */
export type LocateProbe =
  | { kind: "choice"; window: LocateWindow }
  | { kind: "statement"; target: LineSpan; text: string };

export function locateProbes(
  unit: Unit,
  lines: readonly string[],
  mode: LocateMode,
): LocateProbe[] {
  if (mode !== "judge") {
    return locateWindows(unit, lines, mode).map((window) => ({
      kind: "choice",
      window,
    }));
  }

  return unit.locateTargets
    .filter((target) =>
      lines
        .slice(target.startLine - 1, target.endLine)
        .some((line) => isLocatableLine(line)),
    )
    .map((target) => ({
      kind: "statement",
      target,
      text: lines.slice(target.startLine - 1, target.endLine).join("\n"),
    }));
}

/** 回答から指摘する文を選ぶ。回答がない単位は単位全体を返す。 */
export function selectFromProbes(
  unit: Unit,
  probes: readonly LocateProbe[],
  answers: ReadonlyArray<LocateAnswer | undefined>,
): LineSpan[] {
  const statements = probes.flatMap((probe, index) =>
    probe.kind === "statement"
      ? [{ target: probe.target, answer: answers[index] }]
      : [],
  );

  if (statements.length === 0) {
    return selectLocations(
      unit,
      probes.flatMap((probe) => (probe.kind === "choice" ? [probe.window] : [])),
      answers,
    );
  }

  const scored = statements.map(({ target, answer }) => ({
    target,
    probability: answer?.probabilities.violation ?? 0,
  }));
  const selected = scored.filter(
    (entry) => entry.probability >= STATEMENT_VIOLATION_PROBABILITY,
  );

  if (selected.length > 0) {
    return selected.map((entry) => entry.target);
  }

  const best = scored.reduce((left, right) =>
    right.probability > left.probability ? right : left,
  );

  return [best.target];
}

export function locateWindows(
  unit: Unit,
  lines: readonly string[],
  mode: Exclude<LocateMode, "judge">,
): LocateWindow[] {
  const candidates = unit.locateTargets.flatMap((target) =>
    candidatesOf(target, lines, mode),
  );

  if (candidates.length === 0) {
    return [];
  }

  if (candidates.length <= MAX_CHOICES) {
    return [{ candidates, allowsNone: false }];
  }

  const size = MAX_CHOICES - 1;
  const windows: LocateWindow[] = [];

  for (let offset = 0; offset < candidates.length; offset += size) {
    windows.push({
      candidates: candidates.slice(offset, offset + size),
      allowsNone: true,
    });
  }

  return windows;
}

export function windowCriteria(window: LocateWindow): Record<string, string> {
  const criteria: Record<string, string> = Object.fromEntries(
    window.candidates.map((candidate) => [candidate.key, candidate.text]),
  );

  if (window.allowsNone) {
    criteria[NONE_CHOICE] = "No line in these choices shows the violation.";
  }

  return criteria;
}

export type LocateAnswer = {
  choice: string;
  probabilities: Record<string, number>;
};

/** window別の回答から指摘する文を選ぶ。回答がない単位は単位全体を返す。 */
export function selectLocations(
  unit: Unit,
  windows: readonly LocateWindow[],
  answers: ReadonlyArray<LocateAnswer | undefined>,
): LineSpan[] {
  if (windows.length === 0) {
    return [unit.span];
  }

  const selected = new Map<string, LineSpan>();

  windows.forEach((window, index) => {
    const answer = answers[index];

    if (answer === undefined || answer.choice === NONE_CHOICE) {
      return;
    }

    const scores = new Map<string, { target: LineSpan; score: number }>();

    for (const candidate of window.candidates) {
      const key = spanKey(candidate.target);
      const entry = scores.get(key) ?? { target: candidate.target, score: 0 };
      entry.score += answer.probabilities[candidate.key] ?? 0;
      scores.set(key, entry);
    }

    const top = Math.max(0, ...[...scores.values()].map((entry) => entry.score));
    const cutoff = Math.max(LOCATE_MIN_SHARE, top * LOCATE_RELATIVE_SHARE);

    for (const [key, entry] of scores) {
      if (entry.score >= cutoff) {
        selected.set(key, entry.target);
      }
    }
  });

  if (selected.size === 0) {
    return [unit.span];
  }

  return [...selected.values()].sort(
    (left, right) => left.startLine - right.startLine,
  );
}

function candidatesOf(
  target: LineSpan,
  lines: readonly string[],
  mode: Exclude<LocateMode, "judge">,
): LocateCandidate[] {
  const candidates: LocateCandidate[] = [];

  for (let line = target.startLine; line <= target.endLine; line += 1) {
    const text = lines[line - 1] ?? "";

    if (!isLocatableLine(text)) {
      continue;
    }

    const multiline = mode === "statements" && target.endLine > line;
    candidates.push({
      key: `L${line}`,
      text: choiceText(text, multiline),
      target,
    });

    if (mode === "statements") {
      break;
    }
  }

  return candidates;
}

function choiceText(line: string, multiline: boolean): string {
  const trimmed = line.trim();
  const clipped =
    trimmed.length > CHOICE_TEXT_LENGTH
      ? trimmed.slice(0, CHOICE_TEXT_LENGTH - 1) + "…"
      : trimmed;

  return multiline ? `${clipped} …` : clipped;
}

function spanKey(span: LineSpan): string {
  return `${span.startLine}-${span.endLine}`;
}

import type { CalibrationCase } from "./cases.ts";
import { mapConcurrent } from "./concurrency.ts";
import { evaluateSource } from "./engine.ts";
import type {
  ChoiceAnswer,
  DecisionProvider,
  ProviderResponse,
} from "./types.ts";

export type CalibrationRun = {
  answer: ChoiceAnswer;
  durationMs: number;
  model: string;
  usage: ProviderResponse["usage"];
};

export type CalibrationResult = {
  case: CalibrationCase;
  runs: CalibrationRun[];
};

export async function evaluateCalibrationCases(
  cases: CalibrationCase[],
  provider: DecisionProvider,
  repeat: number,
  concurrency: number,
): Promise<CalibrationResult[]> {
  const tasks = cases.flatMap((calibrationCase, caseIndex) =>
    Array.from({ length: repeat }, (_, runIndex) => ({
      calibrationCase,
      caseIndex,
      runIndex,
    })),
  );

  const runs = await mapConcurrent(tasks, concurrency, async (task) => {
    const result = await evaluateSource(
      task.calibrationCase.path,
      task.calibrationCase.source,
      [task.calibrationCase.rule],
      provider,
    );
    const evaluation = result.evaluations[0];

    if (!evaluation) {
      throw new Error(
        task.calibrationCase.path + ": calibration resultがありません。",
      );
    }

    return {
      caseIndex: task.caseIndex,
      runIndex: task.runIndex,
      run: {
        answer: evaluation.answer,
        durationMs: result.durationMs,
        model: result.model,
        usage: result.usage,
      } satisfies CalibrationRun,
    };
  });

  const grouped = cases.map((calibrationCase) => ({
    case: calibrationCase,
    runs: new Array<CalibrationRun>(repeat),
  }));

  for (const item of runs) {
    const result = grouped[item.caseIndex];

    if (!result) {
      throw new Error("calibration resultの集約に失敗しました。");
    }

    result.runs[item.runIndex] = item.run;
  }

  return grouped;
}

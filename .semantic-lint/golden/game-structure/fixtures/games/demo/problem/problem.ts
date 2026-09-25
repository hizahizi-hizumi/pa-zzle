export const DEMO_GENERATOR_VERSION = "2";

export type DemoProblem = {
  cells: readonly number[];
  seed: string;
  generatorVersion: string;
  generationAttempt: number;
};

export function assertDemoProblem(problem: DemoProblem): void {
  if (problem.cells.length !== 25) {
    throw new Error("Demo problem must contain 25 cells");
  }
}

export type ProblemSeed = string;

export function createProblemSeed(): ProblemSeed {
  const values = crypto.getRandomValues(new Uint32Array(4));

  return Array.from(values, (value) =>
    value.toString(16).padStart(8, "0"),
  ).join("");
}

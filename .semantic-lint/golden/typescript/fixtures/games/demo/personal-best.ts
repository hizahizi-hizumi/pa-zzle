export type DemoPersonalBestUpdate = {
  label: string;
  previousValue: string;
  currentValue: string;
};

export function findDemoPersonalBestUpdate(
  previousScore: number,
  currentScore: number,
): DemoPersonalBestUpdate | null {
  if (currentScore <= previousScore) {
    return null;
  }

  return {
    label: "最高評価",
    previousValue: `${previousScore}点`,
    currentValue: `${currentScore}点`,
  };
}

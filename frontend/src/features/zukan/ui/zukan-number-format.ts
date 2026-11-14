export function formatZukanNumber(number: number, digitCount: number): string {
  return `No.${String(number).padStart(digitCount, "0")}`;
}

export function getZukanNumberDigitCount(problemCount: number): number {
  return String(problemCount).length;
}

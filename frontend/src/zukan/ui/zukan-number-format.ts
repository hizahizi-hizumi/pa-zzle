/** 図鑑の番号を、問題集の全問の数の桁まで0で埋めて `No.0001` の形で示す。 */
export function formatZukanNumber(number: number, digitCount: number): string {
  return `No.${String(number).padStart(digitCount, "0")}`;
}

/** 全問の数から、図鑑の番号を埋める桁数を求める。 */
export function getZukanNumberDigitCount(problemCount: number): number {
  return String(problemCount).length;
}

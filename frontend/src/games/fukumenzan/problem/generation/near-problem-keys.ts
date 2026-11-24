import type { FukumenzanProblem } from "@/games/fukumenzan/problem/problem";

const MASK = "*";

function listPermutations<T>(values: readonly T[]): T[][] {
  if (values.length <= 1) {
    return [[...values]];
  }
  return values.flatMap((value, index) =>
    listPermutations(values.toSpliced(index, 1)).map((rest) => [
      value,
      ...rest,
    ]),
  );
}

/** 伏せた所はそのままに、ほかの文字を出た順に A・B・C… へ付け替えた式の文字列。 */
function relabel(addends: readonly string[], result: string): string {
  const labels = new Map<string, string>();
  function relabelWord(word: string): string {
    return [...word]
      .map((letter) => {
        if (letter === MASK) {
          return letter;
        }
        if (!labels.has(letter)) {
          labels.set(letter, String.fromCharCode(65 + labels.size));
        }
        return labels.get(letter)!;
      })
      .join("");
  }
  const relabeledAddends = addends.map(relabelWord);
  return `${relabeledAddends.join("+")}=${relabelWord(result)}`;
}

/**
 * 近い問題のキーの集まり。式の1か所の文字を伏せ、足す数の並べ替えのうち付け替えた文字列が最小のものを、伏せる所ごとに集める。
 * 2つの問題がキーを1つでも共有すれば、1か所の文字だけが違う近い問題になる。
 */
export function listFukumenzanNearProblemKeys({
  addends,
  result,
}: FukumenzanProblem): ReadonlySet<string> {
  const words = [...addends, result];
  const keys = new Set<string>();
  for (const [wordIndex, word] of words.entries()) {
    for (let position = 0; position < word.length; position += 1) {
      const masked = words.map((other, otherIndex) =>
        otherIndex === wordIndex
          ? `${other.slice(0, position)}${MASK}${other.slice(position + 1)}`
          : other,
      );
      const maskedResult = masked[masked.length - 1]!;
      const candidates = listPermutations(masked.slice(0, -1)).map((ordered) =>
        relabel(ordered, maskedResult),
      );
      keys.add(candidates.toSorted()[0]!);
    }
  }
  return keys;
}

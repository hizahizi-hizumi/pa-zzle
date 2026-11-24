import {
  type FukumenzanEquation,
  listFukumenzanLetters,
} from "@/games/fukumenzan/puzzle/equation";
import {
  isFukumenzanSolved,
  listFukumenzanLeadingZeroLetters,
  listFukumenzanMiscalculatedColumns,
} from "@/games/fukumenzan/puzzle/rules";
import {
  type FukumenzanDigit,
  type FukumenzanPuzzleState,
  fukumenzanDigits,
} from "@/games/fukumenzan/puzzle/state";
import {
  createProblemSeededRandom,
  type ProblemRandom,
  shuffleProblemValues,
} from "@/games/problem-seed";

type Assignment = ReadonlyMap<string, FukumenzanDigit | null>;

function parseEquation(text: string): FukumenzanEquation {
  const [left, result] = text.split("=");
  return { addends: left!.split("+"), result: result! };
}

/** 式の文字列と、同じ形の数字の式（例 `985+515=1500`）を並べて、文字ごとの数字を読む。 */
function readSolution(equationText: string, digitsText: string): Assignment {
  const solution = new Map<string, FukumenzanDigit>();
  for (const [index, letter] of [...equationText].entries()) {
    const digit = Number(digitsText[index]);
    if (/[A-Z]/.test(letter)) {
      solution.set(letter, digit as FukumenzanDigit);
    }
  }
  return solution;
}

function createState(
  equation: FukumenzanEquation,
  assignment: Assignment,
): FukumenzanPuzzleState {
  const letters = listFukumenzanLetters(equation);
  return {
    placedDigits: letters.map((letter) => assignment.get(letter) ?? null),
    crossedDigits: letters.map(() => []),
  };
}

function readNumber(word: string, assignment: Assignment): number {
  return [...word].reduce(
    (value, letter) => value * 10 + assignment.get(letter)!,
    0,
  );
}

/**
 * 桁の一覧も繰り上がりも使わず、数として足して確かめる素朴な判定器。
 * 一の位から続けて埋まった桁の数 k を数え、足す数の下 k 桁の和の各桁を答えと比べる。
 * 答えの全部の桁が埋まっていれば、和が答えの桁に収まるかも確かめる。
 */
function judgeNaively(equation: FukumenzanEquation, assignment: Assignment) {
  const words = [...equation.addends, equation.result];
  const isPlaced = (letter: string) =>
    (assignment.get(letter) ?? null) !== null;
  const resultLength = equation.result.length;

  let filledPlaces = 0;
  while (
    filledPlaces < resultLength &&
    words.every((word) => {
      const letter = word[word.length - 1 - filledPlaces];
      return letter === undefined || isPlaced(letter);
    })
  ) {
    filledPlaces += 1;
  }

  const lowSum = equation.addends.reduce(
    (sum, addend) =>
      sum +
      readNumber(addend.slice(-filledPlaces || addend.length), assignment),
    0,
  );
  const miscalculatedColumns: number[] = [];
  for (let place = 0; place < filledPlaces; place += 1) {
    const resultLetter = equation.result[resultLength - 1 - place]!;
    const sumDigit = Math.floor(lowSum / 10 ** place) % 10;
    const overflows =
      place === resultLength - 1 && lowSum >= 10 ** resultLength;
    if (sumDigit !== assignment.get(resultLetter) || overflows) {
      miscalculatedColumns.push(place);
    }
  }

  const leadingZeroLetters = new Set(
    words
      .filter((word) => word.length > 1 && assignment.get(word[0]!) === 0)
      .map((word) => word[0]!),
  );

  const allPlaced = listFukumenzanLetters(equation).every(isPlaced);
  const solved =
    allPlaced &&
    leadingZeroLetters.size === 0 &&
    equation.addends.reduce(
      (sum, addend) => sum + readNumber(addend, assignment),
      0,
    ) === readNumber(equation.result, assignment);

  return { miscalculatedColumns, leadingZeroLetters, solved };
}

const solvedEquations = [
  ["BYK+KTK=TKHH", "985+515=1500"],
  ["LLJH+LHW=JAWCJ", "9913+938=10851"],
  ["NNV+UFN+NTT=NFVT", "119+801+177=1097"],
  ["YFL+YAD+ADY=YLYY", "143+197+971=1311"],
  ["GHL+LGF+FFF=GHFW", "176+619+999=1794"],
  ["DBRPR+UTTDR+UDDP=DDUURJ", "18636+92216+9113=119965"],
  ["GVANK+FFFGB+VWNN=BGAVKB", "82573+99981+2677=185231"],
  ["KBBKC+EAWKB+WWKT=AACEBC", "72279+41572+5578=119429"],
  ["SEND+MORE=MONEY", "9567+1085=10652"],
] as const;

/**
 * 途中の対応を作る。半分は文字に無作為な違う数字を置き、半分は解から何文字かを入れ替えて、
 * 一の位から長く埋まって足し算が合う桁と合わない桁が混ざるようにする。どちらも空の文字を残すことがある。
 */
function createRandomAssignment(
  letters: readonly string[],
  solution: Assignment,
  random: ProblemRandom,
): Assignment {
  const digits = shuffleProblemValues(fukumenzanDigits, random);
  const fromSolution = random() < 0.5;
  const blankRate = random() * 0.5;
  const assignment = new Map<string, FukumenzanDigit | null>();
  const used = new Set<FukumenzanDigit>();
  for (const [index, letter] of letters.entries()) {
    const candidate = fromSolution
      ? random() < 0.8
        ? solution.get(letter)!
        : digits[index]!
      : digits[index]!;
    if (random() < blankRate || used.has(candidate)) {
      assignment.set(letter, null);
    } else {
      assignment.set(letter, candidate);
      used.add(candidate);
    }
  }
  return assignment;
}

describe("isFukumenzanSolved", () => {
  test.each(solvedEquations)(
    "%s を解の数字で埋めるとクリアにすること",
    (equationText, digitsText) => {
      const equation = parseEquation(equationText);
      const state = createState(
        equation,
        readSolution(equationText, digitsText),
      );

      const solved = isFukumenzanSolved(equation, state);

      expect(solved).toBe(true);
    },
  );

  describe("1文字が空の場合", () => {
    const equation = parseEquation("BYK+KTK=TKHH");
    const assignment = new Map(readSolution("BYK+KTK=TKHH", "985+515=1500"));
    assignment.set("B", null);
    const state = createState(equation, assignment);

    test("クリアにしないこと", () => {
      const solved = isFukumenzanSolved(equation, state);

      expect(solved).toBe(false);
    });
  });
});

describe("listFukumenzanMiscalculatedColumns", () => {
  describe("一の位から2桁が埋まり、十の位だけ合わない場合", () => {
    // 一の位は K + K = 5 + 5 = 10 で H の 0 と合う。十の位は Y + T と繰り上がりで 8 + 2 + 1 = 11 になり、H の 0 と合わない。
    const equation = parseEquation("BYK+KTK=TKHH");
    const state = createState(
      equation,
      new Map<string, FukumenzanDigit | null>([
        ["Y", 8],
        ["K", 5],
        ["T", 2],
        ["H", 0],
      ]),
    );

    test("埋まった桁のうち合わない桁だけを返すこと", () => {
      const columns = listFukumenzanMiscalculatedColumns(equation, state);

      expect(columns).toEqual([1]);
    });
  });

  describe("一の位が空の場合", () => {
    const equation = parseEquation("BYK+KTK=TKHH");
    const state = createState(
      equation,
      new Map<string, FukumenzanDigit | null>([
        ["B", 1],
        ["Y", 2],
        ["T", 3],
        ["H", 4],
      ]),
    );

    test("ほかの桁が埋まっていても確かめないこと", () => {
      const columns = listFukumenzanMiscalculatedColumns(equation, state);

      expect(columns).toEqual([]);
    });
  });

  describe("全部の桁が合い、いちばん左の桁から繰り上がる場合", () => {
    // 56 + 47 = 103 は、どの桁の一の位も答えと合うが、答えの2桁に収まらない。
    const equation = parseEquation("AB+CD=EF");
    const state = createState(
      equation,
      new Map<string, FukumenzanDigit | null>([
        ["A", 5],
        ["B", 6],
        ["C", 4],
        ["D", 7],
        ["E", 0],
        ["F", 3],
      ]),
    );

    test("いちばん左の桁を合わない桁にすること", () => {
      const columns = listFukumenzanMiscalculatedColumns(equation, state);

      expect(columns).toEqual([1]);
    });
  });
});

describe("listFukumenzanLeadingZeroLetters", () => {
  const equation = parseEquation("NNV+UFN+NTT=NFVT");
  const state = createState(
    equation,
    new Map<string, FukumenzanDigit | null>([
      ["U", 0],
      ["F", 1],
    ]),
  );

  test("0 を入れた、2桁以上の数の先頭の文字だけを返すこと", () => {
    const letters = listFukumenzanLeadingZeroLetters(equation, state);

    // N V U F T
    expect(letters).toEqual([2]);
  });
});

describe("無作為な途中の対応", () => {
  const trialsPerEquation = 3000;
  const cases = solvedEquations.map(
    ([equationText, digitsText]) =>
      [
        equationText,
        parseEquation(equationText),
        readSolution(equationText, digitsText),
      ] as const,
  );

  test.each(cases)(
    "%s で、知らせとクリアが素朴な判定器と一致すること",
    (equationText, equation, solution) => {
      const random = createProblemSeededRandom(`rules-${equationText}`);
      const letters = listFukumenzanLetters(equation);
      const mismatches: string[] = [];
      for (let trial = 0; trial < trialsPerEquation; trial += 1) {
        const assignment = createRandomAssignment(letters, solution, random);
        const state = createState(equation, assignment);
        const expected = judgeNaively(equation, assignment);
        const actual = {
          miscalculatedColumns: [
            ...listFukumenzanMiscalculatedColumns(equation, state),
          ],
          leadingZeroLetters: new Set(
            listFukumenzanLeadingZeroLetters(equation, state).map(
              (letter) => letters[letter]!,
            ),
          ),
          solved: isFukumenzanSolved(equation, state),
        };
        if (
          JSON.stringify(serialize(actual)) !==
          JSON.stringify(serialize(expected))
        ) {
          mismatches.push(
            `${state.placedDigits.join(",")}: ${JSON.stringify(serialize(actual))} / ${JSON.stringify(serialize(expected))}`,
          );
        }
      }

      expect(mismatches).toEqual([]);
    },
  );

  function serialize(judgement: ReturnType<typeof judgeNaively>) {
    return {
      ...judgement,
      leadingZeroLetters: [...judgement.leadingZeroLetters].sort(),
    };
  }
});

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { ReactElement } from "react";

import { HowToPlayExamplePanel } from "@/components/HowToPlayExamplePanel";
import { BLOCKED_MARK_DURATION_MS } from "@/games/hitofude-puzzle/ui/board/animate-blocked-move";
import {
  allCellsRuleExamples,
  extendOperationExample,
  holeRuleExample,
  onceRuleExample,
  rewindOperationExample,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/figure-boards";
import { TouchableExample } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/TouchableExample";
import {
  playLayeredSound,
  playSound,
  type SoundEffect,
} from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

/** 盤面の動き（先端の揺れ・×・行き止まりの膨らみ・完成の光）。動かした要素の印を記録し、すぐ終える。 */
const animate = vi.fn(function createFinishedAnimation(): Animation {
  return {
    finished: Promise.resolve(),
    cancel: vi.fn(),
  } as unknown as Animation;
});

beforeEach(() => {
  animate.mockClear();
  Element.prototype.animate = animate as unknown as Element["animate"];
});

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
  Reflect.deleteProperty(Element.prototype, "animate");
});

/** 本番と同じく、元に戻すボタンを持つ例の面に置いて描く。 */
function renderInPanel(example: ReactElement): void {
  render(<HowToPlayExamplePanel resettable>{example}</HowToPlayExamplePanel>);
}

/** 例の図。名前は図に添えた判定の言葉から付く。 */
function getFigure(): HTMLElement {
  return screen.getByRole("figure");
}

/** 例の図の、今見えている判定の言葉。図は添えた言葉で呼ばれ、見せない言葉は読み上げから外しているので、図の名前に出る。 */
function readVerdict(): string {
  let verdict = "";
  screen.getByRole("figure", {
    name: (name) => {
      verdict = name;
      return true;
    },
  });
  return verdict;
}

/**
 * マスを押す。盤面のマスのボタンは、キーボードと支援技術から押す受け口で、本番と同じく押して離した1回の手になる。
 * マス番号（3×3）は行優先で、0 が1行1列。
 */
function pressCell(cell: number): void {
  const row = Math.floor(cell / 3) + 1;
  const column = (cell % 3) + 1;
  fireEvent.click(
    within(getFigure()).getByRole("button", {
      name: new RegExp(`^${row}行${column}列`),
    }),
  );
}

function getHintedCell(): string | null {
  return (
    getFigure()
      .querySelector("[data-hinted-cell]")
      ?.getAttribute("data-hinted-cell") ?? null
  );
}

/** 元に戻すボタンを出しているか。出さない間も場所は取り、押せなくしている。 */
function isResetShown(): boolean {
  return !screen.getByRole<HTMLButtonElement>("button", {
    name: "例を元に戻す",
  }).disabled;
}

function listPlayedSoundUrls(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => (sound as SoundEffect & { url: string }).url);
}

/** 動かした要素の印（data-*）。 */
function listAnimatedParts(): string[] {
  return animate.mock.contexts.flatMap((element) =>
    Array.from((element as Element).attributes)
      .map(({ name }) => name)
      .filter((name) => name.startsWith("data-")),
  );
}

/** 手ごとの印を付けたマスと、その印。 */
function listCandidateMarks(): string[] {
  return Array.from(
    getFigure().querySelectorAll("[data-candidate-cell]"),
    (mark) =>
      `${mark.getAttribute("data-candidate-cell")}:${mark.getAttribute("data-candidate-verdict")}`,
  );
}

/** 残ったマスの印を付けたマス。 */
function listRemainingMarks(): string[] {
  return Array.from(
    getFigure().querySelectorAll("[data-remaining-cell]"),
    (mark) => mark.getAttribute("data-remaining-cell") ?? "",
  );
}

/** 盤面に重ねた、指で押す・なぞる面。 */
function getBoardGroup(): HTMLElement {
  return within(getFigure()).getByRole("group", { name: /盤面 3行\d列$/ });
}

/** 3×3 の盤面を 300px 四方に置いたときの、マスの中央。見せない列があっても、盤面部品は3列の幅で置く。 */
function getCellCenter(cell: number) {
  return {
    clientX: ((cell % 3) + 0.5) * 100,
    clientY: (Math.floor(cell / 3) + 0.5) * 100,
  };
}

const touch = { pointerId: 1, pointerType: "touch", isPrimary: true };

/** 指で `from` のマスを押したまま、`to` のマスまでなぞって離す。 */
function drag(from: number, to: number): void {
  vi.spyOn(getBoardGroup(), "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 300, 300),
  );
  fireEvent.pointerDown(getBoardGroup(), { ...touch, ...getCellCenter(from) });
  fireEvent.pointerMove(getBoardGroup(), { ...touch, ...getCellCenter(to) });
  fireEvent.pointerUp(getBoardGroup(), touch);
}

describe("TouchableExample", () => {
  describe.each([
    [
      "同じマス",
      onceRuleExample,
      "visited",
      {
        hinted: "3",
        initialMarks: ["1:allowed", "7:disallowed", "3:allowed"],
        allowedCell: 3,
        extendedMarks: ["0:allowed", "6:disallowed"],
        extendedVerdict: "通れる、通れない",
        cameCell: 4,
        farCell: 2,
        pathCell: 5,
      },
    ],
    [
      "穴",
      holeRuleExample,
      "hole",
      {
        hinted: "4",
        initialMarks: ["4:disallowed", "6:allowed"],
        allowedCell: 6,
        extendedMarks: ["3:allowed"],
        extendedVerdict: "通れる",
        cameCell: 7,
        farCell: 3,
        pathCell: 5,
      },
    ],
  ] as const)("%sのルールの例の場合", (_, example, rule, expected) => {
    beforeEach(() => {
      renderInPanel(
        <TouchableExample example={example} caption={{ kind: "move", rule }} />,
      );
    });

    test("触る前は、通れないマスと通れるマスに手ごとの印を付け、凡例を添えること", () => {
      const marks = listCandidateMarks();

      expect(marks).toEqual(expected.initialMarks);
      expect(getHintedCell()).toBe(expected.hinted);
      expect(readVerdict()).toBe("通れる、通れない");
      expect(isResetShown()).toBe(false);
      expect(animate).not.toHaveBeenCalled();
    });

    test("通れるマスを押すと、本番と同じく道が延びて延ばす音が鳴り、完成も行き止まりもせず、新しい先端の隣に印を付け直して、盤面にある印の凡例だけを添えること", () => {
      pressCell(expected.allowedCell);

      expect(listPlayedSoundUrls()).toEqual([
        expect.stringContaining("path-extended"),
      ]);
      expect(listAnimatedParts()).toEqual([]);
      expect(listCandidateMarks()).toEqual(expected.extendedMarks);
      expect(readVerdict()).toBe(expected.extendedVerdict);
      expect(isResetShown()).toBe(true);
    });

    describe("通れるマスへ延ばした場合", () => {
      beforeEach(() => {
        pressCell(expected.allowedCell);
      });

      test("来た道のマスを押して触る前の道に戻すと、触る前の手がかりと印と凡例に戻り、元に戻すボタンを消すこと", () => {
        pressCell(expected.cameCell);

        expect(getHintedCell()).toBe(expected.hinted);
        expect(listCandidateMarks()).toEqual(expected.initialMarks);
        expect(readVerdict()).toBe("通れる、通れない");
        expect(isResetShown()).toBe(false);
      });
    });

    test("先端から離れたマスを押すと、本番と同じく×を点けて弾き、判定に通れないと別の理由を添えること", () => {
      pressCell(expected.farCell);

      expect(listAnimatedParts()).toEqual(["data-head", "data-blocked-mark"]);
      expect(listPlayedSoundUrls()).toEqual([
        expect.stringContaining("blocked"),
      ]);
      expect(readVerdict()).toBe("通れない・離れたマス");
      expect(listCandidateMarks()).toEqual(expected.initialMarks);
      expect(getHintedCell()).toBeNull();
      expect(isResetShown()).toBe(false);
    });

    describe("道を戻してから元に戻した場合", () => {
      beforeEach(() => {
        pressCell(expected.pathCell);
        fireEvent.click(screen.getByRole("button", { name: "例を元に戻す" }));
      });

      test("触る前の手がかりと印と凡例に戻ること", () => {
        const shown = getHintedCell();

        expect(shown).toBe(expected.hinted);
        expect(listCandidateMarks()).toEqual(expected.initialMarks);
        expect(readVerdict()).toBe("通れる、通れない");
        expect(isResetShown()).toBe(false);
      });
    });
  });

  describe("同じマスのルールの例の場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      renderInPanel(
        <TouchableExample
          example={onceRuleExample}
          caption={{ kind: "move", rule: "visited" }}
        />,
      );
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe("先端から離れたマスを押して弾かれた場合", () => {
      beforeEach(() => {
        pressCell(2);
      });

      test("×が消える前に、そのマスが隣になるマスへ延ばすと、そのマスに通れる印を付け、盤面にある印の凡例だけを添えること", () => {
        pressCell(1);

        expect(listCandidateMarks()).toEqual(["2:allowed", "0:allowed"]);
        expect(readVerdict()).toBe("通れる");
      });

      test("元に戻してから同じマスへ延ばしても、そのマスに通れる印を付けること", () => {
        pressCell(3);
        pressCell(2);
        fireEvent.click(screen.getByRole("button", { name: "例を元に戻す" }));
        pressCell(1);

        expect(listCandidateMarks()).toEqual(["2:allowed", "0:allowed"]);
      });
    });

    test("✕ の印の通ったマスを押すと、本番と同じくそこまで戻って縮める音が鳴り、入ったのではなく道が戻ったと言い、戻した先端の隣に印を付け直して元に戻すボタンを出すこと", () => {
      pressCell(7);

      expect(
        within(getFigure()).getByRole("button", { name: /^3行2列 先端/ }),
      ).toBeDefined();
      expect(listPlayedSoundUrls()).toEqual([
        expect.stringContaining("path-shortened"),
      ]);
      expect(animate).not.toHaveBeenCalled();
      expect(readVerdict()).toBe("押したマスまで道が戻った");
      expect(listCandidateMarks()).toEqual(["4:allowed", "8:allowed"]);
      expect(isResetShown()).toBe(true);
    });

    test("先端から通ったマスへなぞっても、本番と同じく何も起きないこと", () => {
      drag(4, 7);

      expect(
        within(getFigure()).getByRole("button", { name: /^2行2列 先端/ }),
      ).toBeDefined();
      expect(playSound).not.toHaveBeenCalled();
      expect(readVerdict()).toBe("通れる、通れない");
    });

    test("左の列から上の行を通ってすべてのマスを通ると、完成と判定し、本番のクリア演出とクリア音を返して、それからは受け付けないこと", () => {
      for (const cell of [3, 0, 1, 2]) {
        pressCell(cell);
      }

      expect(readVerdict()).toBe("完成");
      expect(listCandidateMarks()).toEqual([]);
      expect(listRemainingMarks()).toEqual([]);
      expect(listAnimatedParts()).toEqual([
        "data-clear-trace",
        "data-end-mark",
      ]);
      expect(playLayeredSound).toHaveBeenCalledTimes(1);
      expect(
        within(getFigure())
          .getAllByRole("button")
          .every((button) => (button as HTMLButtonElement).disabled),
      ).toBe(true);
    });

    test("マスを残して行き止まりになると、本番と同じく先端を膨らませ、行き止まりと残りのマスの数を言い、手ごとの印を消して残ったマスに印を付けること", () => {
      for (const cell of [1, 0, 3]) {
        pressCell(cell);
      }

      expect(listAnimatedParts()).toEqual(["data-head"]);
      expect(readVerdict()).toBe("行き止まり・1マス残る");
      expect(listCandidateMarks()).toEqual([]);
      expect(listRemainingMarks()).toEqual(["2"]);
    });
  });

  describe("穴のルールの例の場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      renderInPanel(
        <TouchableExample
          example={holeRuleExample}
          caption={{ kind: "move", rule: "hole" }}
        />,
      );
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("穴を押すと、本番と同じく先端を上へ揺らして×を点け、阻まれた音を鳴らし、通れないと穴を言い、×が点いている間だけ穴の印を消し、道は変わらないので元に戻すボタンを出さないこと", () => {
      pressCell(4);

      expect(listAnimatedParts()).toEqual(["data-head", "data-blocked-mark"]);
      expect(listPlayedSoundUrls()).toEqual([
        expect.stringContaining("blocked"),
      ]);
      expect(listCandidateMarks()).toEqual(["6:allowed"]);
      expect(readVerdict()).toBe("通れない・穴");
      expect(getHintedCell()).toBeNull();
      expect(isResetShown()).toBe(false);
    });

    describe("穴を押して弾かれた場合", () => {
      beforeEach(() => {
        pressCell(4);
      });

      test("×が消えたら、穴の印と、弾かれる前の凡例に戻すこと", () => {
        act(() => {
          vi.advanceTimersByTime(BLOCKED_MARK_DURATION_MS);
        });

        expect(listCandidateMarks()).toEqual(["4:disallowed", "6:allowed"]);
        expect(readVerdict()).toBe("通れる、通れない");
        expect(getHintedCell()).toBeNull();
      });

      test("×が消える前に通れるマスへ延ばしても、本番と同じく×を途中で消さず、動かし直しもしないこと", () => {
        pressCell(6);

        expect(getFigure().querySelector("[data-blocked-mark]")).not.toBeNull();
        expect(listAnimatedParts()).toEqual(["data-head", "data-blocked-mark"]);
        expect(readVerdict()).toBe("通れる");
      });
    });

    test("先端から穴へなぞると、本番のなぞりと同じく、穴で弾いて先端を揺らして×を点け、阻まれた音を鳴らすこと", () => {
      drag(7, 4);

      expect(listAnimatedParts()).toEqual(["data-head", "data-blocked-mark"]);
      expect(listPlayedSoundUrls()).toEqual([
        expect.stringContaining("blocked"),
      ]);
      expect(
        within(getFigure()).getByRole("button", { name: /^3行2列 先端/ }),
      ).toBeDefined();
    });

    test("道のマスを押して縮めると、縮めた先端の隣の穴と通れるマスに印を付け直し、道が戻ったと言うこと", () => {
      pressCell(5);

      expect(listCandidateMarks()).toEqual(["8:allowed", "4:disallowed"]);
      expect(readVerdict()).toBe("押したマスまで道が戻った");
    });

    test("道の始点を押して縮めると、始点の隣の通れるマスに印を付け直し、道が戻ったと言うこと", () => {
      pressCell(0);

      expect(listCandidateMarks()).toEqual(["1:allowed", "3:allowed"]);
      expect(readVerdict()).toBe("押したマスまで道が戻った");
    });

    describe("道を戻してから弾かれた場合", () => {
      beforeEach(() => {
        pressCell(5);
        pressCell(6);
      });

      test("×が点いている間は通れないと言い、×が消えたら道が戻ったことに戻すこと", () => {
        expect(readVerdict()).toBe("通れない・離れたマス");

        act(() => {
          vi.advanceTimersByTime(BLOCKED_MARK_DURATION_MS);
        });

        expect(readVerdict()).toBe("押したマスまで道が戻った");
      });
    });

    test("左の列を通ってすべてのマスを通ると、完成と判定すること", () => {
      for (const cell of [6, 3]) {
        pressCell(cell);
      }

      expect(readVerdict()).toBe("完成");
      expect(listCandidateMarks()).toEqual([]);
    });
  });

  describe("すべてのマスのルールの、できる形の場合", () => {
    beforeEach(() => {
      renderInPanel(
        <TouchableExample
          example={allCellsRuleExamples[0]}
          caption={{ kind: "shape" }}
        />,
      );
    });

    test("本番の完成した盤面の見た目で、クリア演出を返さずに静止させ、完成と判定し、受け付けないこと", () => {
      const endMark = getFigure().querySelector("[data-end-mark]");

      expect(endMark).not.toBeNull();
      expect(animate).not.toHaveBeenCalled();
      expect(playLayeredSound).not.toHaveBeenCalled();
      expect(readVerdict()).toBe("完成");
      expect(
        within(getFigure())
          .getAllByRole("button")
          .every((button) => (button as HTMLButtonElement).disabled),
      ).toBe(true);
    });
  });

  describe("すべてのマスのルールの、できない形の場合", () => {
    beforeEach(() => {
      renderInPanel(
        <TouchableExample
          example={allCellsRuleExamples[1]}
          caption={{ kind: "shape" }}
        />,
      );
    });

    test("本番と同じ行き止まりの先端で、膨らませずに静止させ、行き止まりと残りのマスの数を言うこと", () => {
      const head = within(getFigure()).getByRole("button", {
        name: "1行2列 先端 行き止まり",
      });

      expect(head).toBeDefined();
      expect(readVerdict()).toBe("行き止まり・1マス残る");
      expect(listRemainingMarks()).toEqual(["6"]);
      expect(animate).not.toHaveBeenCalled();
    });

    test("切り落とした右の列のマスは見せず、読み上げでも盤面を見えている列の数で言うこと", () => {
      const hiddenColumn = [2, 5, 8].map((cell) =>
        getFigure().querySelector(`[data-cell="${cell}"]`),
      );

      expect(hiddenColumn.every((cell) => cell !== null)).toBe(true);
      expect(
        hiddenColumn.every(
          (cell) => getComputedStyle(cell!).visibility === "hidden",
        ),
      ).toBe(true);
      expect(
        within(getFigure())
          .getAllByRole("button")
          .some((button) =>
            /^\d行3列/.test(button.getAttribute("aria-label") ?? ""),
          ),
      ).toBe(false);
      expect(
        within(getFigure()).getByRole("group", { name: /盤面 3行2列$/ }),
      ).toBeDefined();
    });

    test("切り落とした右の列は、押してなぞっても受けないこと", () => {
      drag(2, 5);

      expect(playSound).not.toHaveBeenCalled();
      expect(animate).not.toHaveBeenCalled();
    });

    test("道のマスを押すと、本番と同じくそこまで戻り、今の盤面を途中と判定して残りのマスの数を言い、残ったマスに印を付け、元に戻すボタンを出すこと", () => {
      pressCell(3);

      expect(
        within(getFigure()).getByRole("button", { name: /^2行1列 先端/ }),
      ).toBeDefined();
      expect(readVerdict()).toBe("途中・3マス残る");
      expect(listRemainingMarks()).toEqual(["0", "1", "6"]);
      expect(isResetShown()).toBe(true);
    });

    describe("道のマスを押して戻した場合", () => {
      beforeEach(() => {
        pressCell(3);
      });

      test("別のマスを残して行き止まりにすると、本番と同じく先端を膨らませ、行き止まりと今の残りのマスの数を言うこと", () => {
        pressCell(6);

        expect(listAnimatedParts()).toEqual(["data-head"]);
        expect(readVerdict()).toBe("行き止まり・2マス残る");
      });

      test("触る前の道へ延ばし直すと、判定と元に戻すボタンを触る前の姿に戻すこと", () => {
        pressCell(0);
        pressCell(1);

        expect(readVerdict()).toBe("行き止まり・1マス残る");
        expect(isResetShown()).toBe(false);
      });
    });
  });

  describe("延ばし方の操作の例の場合", () => {
    beforeEach(() => {
      renderInPanel(<TouchableExample example={extendOperationExample} />);
    });

    test("判定を添えず、3マス延ばした後は、来た道を戻る所に手がかりを付けること", async () => {
      for (const cell of [1, 0, 3]) {
        pressCell(cell);
      }
      await act(async () => {});

      expect(getFigure().querySelector("figcaption")).toBeNull();
      expect(getHintedCell()).toBe("0");
    });

    describe("3マス延ばした場合", () => {
      beforeEach(() => {
        for (const cell of [1, 0, 3]) {
          pressCell(cell);
        }
      });

      test("来た道をなぞって戻ると、本番と同じく道が縮み、手がかりを打ち終えること", () => {
        drag(3, 0);

        expect(
          within(getFigure()).getByRole("button", { name: /^1行1列 先端/ }),
        ).toBeDefined();
        expect(listPlayedSoundUrls().at(-1)).toContain("path-shortened");
        expect(getHintedCell()).toBeNull();
      });

      test("来た道のマスを押して縮めても、なぞる手を打っていないので、手がかりを消すこと", () => {
        pressCell(0);

        expect(
          within(getFigure()).getByRole("button", { name: /^1行1列 先端/ }),
        ).toBeDefined();
        expect(getHintedCell()).toBeNull();
      });

      describe("来た道のマスを押して縮めた場合", () => {
        beforeEach(() => {
          pressCell(0);
        });

        test("また延ばすと、なぞって戻る手の手がかりをまた付けること", () => {
          pressCell(3);

          expect(getHintedCell()).toBe("0");
        });
      });
    });
  });

  describe("道の途中を押して縮める操作の例の場合", () => {
    beforeEach(() => {
      renderInPanel(<TouchableExample example={rewindOperationExample} />);
    });

    test("道の途中を押すと、本番と同じくそこまで縮み、縮める音を鳴らし、引き直す手のマスへ手がかりを移すこと", () => {
      pressCell(1);

      expect(
        within(getFigure()).getByRole("button", { name: /^1行2列 先端/ }),
      ).toBeDefined();
      expect(listPlayedSoundUrls()).toEqual([
        expect.stringContaining("path-shortened"),
      ]);
      expect(getHintedCell()).toBe("4");
      expect(isResetShown()).toBe(true);
    });

    describe("道の途中を押して縮めた場合", () => {
      beforeEach(() => {
        pressCell(1);
      });

      test("触る前の道へ延ばし直すと、手がかりと元に戻すボタンを触る前の姿に戻すこと", () => {
        for (const cell of [2, 5, 4, 3]) {
          pressCell(cell);
        }

        expect(getHintedCell()).toBe("1");
        expect(isResetShown()).toBe(false);
      });
    });
  });
});

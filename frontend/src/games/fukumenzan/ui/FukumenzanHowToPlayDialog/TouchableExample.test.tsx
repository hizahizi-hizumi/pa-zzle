import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReactElement } from "react";

import { HowToPlayExamplePanel } from "@/components/HowToPlayExamplePanel";
import {
  crossOperationExample,
  crossShownOperationExample,
  type FukumenzanHowToPlayExample,
  leadingZeroRuleExamples,
  moveOperationExample,
  placeOperationExample,
  replaceOperationExample,
  returnOperationExample,
  sameLetterRuleExample,
  sumRuleExamples,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-definitions";
import { TouchableExample } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/TouchableExample";
import { fukumenzanToneClassNames } from "@/games/fukumenzan/ui/fukumenzan-tone";
import { playSound, type SoundEffect } from "@/lib/audio/sound-effects";

vi.mock("@/lib/audio/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

/** クリア演出の動き。すぐ終える。 */
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
  Reflect.deleteProperty(Element.prototype, "animate");
  Reflect.deleteProperty(document, "elementFromPoint");
});

const touch = { pointerType: "touch", button: 0, isPrimary: true };

/** 本番と同じく、元に戻すボタンを持つ例の面に置いて描く。 */
function renderInPanel(example: ReactElement): void {
  render(<HowToPlayExamplePanel resettable>{example}</HowToPlayExamplePanel>);
}

function renderExample(example: FukumenzanHowToPlayExample): void {
  renderInPanel(<TouchableExample example={example} />);
}

function getFigures(): HTMLElement[] {
  return screen.getAllByRole("figure");
}

function getEquation(figure = getFigures()[0]!) {
  return within(within(figure).getByRole("group", { name: "式" }));
}

function getCardRow(figure = getFigures()[0]!) {
  return within(within(figure).getByRole("group", { name: "札" }));
}

/** 文字の最初の場所。 */
function getLetter(name: string): HTMLElement {
  return getEquation().getAllByRole("button", { name })[0]!;
}

function listCardNames(): (string | null)[] {
  return getCardRow()
    .getAllByRole("button")
    .map((card) => card.getAttribute("aria-label"));
}

/** 手がかりを重ねた押す所の読み上げ名。手がかりが無ければ `null`。 */
function readHintTarget(): string | null {
  const hint = document.querySelector("[data-how-to-play-press-hint]");
  return hint?.closest("button")?.getAttribute("aria-label") ?? null;
}

function readVerdict(): string {
  let caption = "";
  screen.getByRole("figure", {
    name: (name) => {
      caption = name;
      return true;
    },
  });
  return caption;
}

function isResetShown(): boolean {
  return !screen.getByRole<HTMLButtonElement>("button", {
    name: "例を元に戻す",
  }).disabled;
}

function hasClassTokens(element: Element, classNames: string): boolean {
  return classNames
    .split(" ")
    .every((token) => element.querySelector(`[class~="${token}"]`) !== null);
}

/** 指で運んで、落とし先の上で離す。落とし先は指の下の要素として返す。 */
function dragByTouch(source: HTMLElement, target: HTMLElement): void {
  document.elementFromPoint = vi.fn((x: number, y: number) =>
    x === 100 && y === 200 ? target : null,
  );
  fireEvent.pointerDown(source, {
    ...touch,
    pointerId: 1,
    clientX: 100,
    clientY: 500,
  });
  fireEvent.pointerMove(source, {
    ...touch,
    pointerId: 1,
    clientX: 100,
    clientY: 200,
  });
  fireEvent.pointerUp(source, {
    ...touch,
    pointerId: 1,
    clientX: 100,
    clientY: 200,
  });
}

describe("TouchableExample", () => {
  describe("札を入れる例の場合", () => {
    beforeEach(() => {
      renderExample(placeOperationExample);
    });

    test("触る前は札の並びの 5〜9 の段だけを見せ、8 の札に手がかりを付けること", () => {
      expect([listCardNames(), readHintTarget()]).toEqual([
        ["5 の札", "6 の札", "7 の札", "8 の札", "9 の札"],
        "8 の札",
      ]);
    });

    test("札を押すと手がかりを D へ移すこと", () => {
      fireEvent.click(getCardRow().getByRole("button", { name: "8 の札" }));

      expect(readHintTarget()).toBe("D");
    });

    describe("札を押してから D を押した場合", () => {
      beforeEach(() => {
        fireEvent.click(getCardRow().getByRole("button", { name: "8 の札" }));
        fireEvent.click(getLetter("D"));
      });

      test("D の全部の場所に 8 が入り、手がかりを消すこと", () => {
        expect([
          getEquation().getAllByRole("button", { name: "D に 8" }).length,
          readHintTarget(),
        ]).toEqual([4, null]);
      });

      test("本番と同じく札を入れる音を鳴らすこと", () => {
        expect(
          vi
            .mocked(playSound)
            .mock.calls.map(
              ([sound]) =>
                (sound as SoundEffect).url.match(/([\w-]+)\.flac/)?.[1],
            ),
        ).toEqual(["placed"]);
      });

      test("元に戻すと、触る前の姿と手がかりに戻ること", () => {
        fireEvent.click(screen.getByRole("button", { name: "例を元に戻す" }));

        expect([
          getEquation().queryAllByRole("button", { name: "D に 8" }).length,
          readHintTarget(),
        ]).toEqual([0, "8 の札"]);
      });
    });

    test("札を D へ運ぶと D の全部の場所に入ること", () => {
      dragByTouch(
        getCardRow().getByRole("button", { name: "8 の札" }),
        getEquation().getAllByRole("button", { name: "D" })[1]!,
      );

      expect(
        getEquation().getAllByRole("button", { name: "D に 8" }),
      ).toHaveLength(4);
    });

    test("押すだけの空の文字では指のスクロールを止めず、札では止めること", () => {
      expect([
        getLetter("D").classList.contains("touch-manipulation"),
        getCardRow()
          .getByRole("button", { name: "8 の札" })
          .classList.contains("touch-none"),
      ]).toEqual([true, true]);
    });
  });

  test("ほかの例の文字の上で離しても札を入れないこと", () => {
    render(
      <>
        <HowToPlayExamplePanel resettable>
          <TouchableExample example={placeOperationExample} />
        </HowToPlayExamplePanel>
        <HowToPlayExamplePanel resettable>
          <TouchableExample example={placeOperationExample} />
        </HowToPlayExamplePanel>
      </>,
    );
    const [first, second] = getFigures();

    dragByTouch(
      getCardRow(first).getByRole("button", { name: "8 の札" }),
      getEquation(second).getAllByRole("button", { name: "D" })[0]!,
    );

    expect(screen.queryAllByRole("button", { name: "D に 8" })).toEqual([]);
  });

  describe("同じ文字のルールの例の場合", () => {
    beforeEach(() => {
      renderExample(sameLetterRuleExample);
    });

    test("触る前は X の 8 に手がかりを付けること", () => {
      expect(readHintTarget()).toBe("X に 8");
    });

    test("X の 8 を D へ運ぶと、D の全部の場所に 8 が入り、X が空になること", () => {
      dragByTouch(getLetter("X に 8"), getLetter("D"));

      expect([
        getEquation().getAllByRole("button", { name: "D に 8" }).length,
        getEquation().getAllByRole("button", { name: "X" }).length,
      ]).toEqual([4, 1]);
    });
  });

  describe("札の入った文字へ別の札を入れる例の場合", () => {
    beforeEach(() => {
      renderExample(replaceOperationExample);
    });

    test("触る前は 8 の札に手がかりを付けること", () => {
      expect(readHintTarget()).toBe("8 の札");
    });

    test("8 を D に入れると、前の 6 が札の並びへ戻ること", () => {
      fireEvent.click(getCardRow().getByRole("button", { name: "8 の札" }));
      fireEvent.click(getLetter("D に 6"));

      expect([
        getEquation().getAllByRole("button", { name: "D に 8" }).length,
        getCardRow().queryByRole("button", { name: "6 の札" }) !== null,
      ]).toEqual([4, true]);
    });
  });

  test("文字に入った札を別の文字へ運ぶと、元の文字が空になること", () => {
    renderExample(moveOperationExample);

    dragByTouch(getLetter("U に 8"), getLetter("D"));

    expect([
      getEquation().getAllByRole("button", { name: "D に 8" }).length,
      getEquation().getAllByRole("button", { name: "U" }).length,
    ]).toEqual([4, 2]);
  });

  describe("札を戻す例の場合", () => {
    beforeEach(() => {
      renderExample(returnOperationExample);
    });

    test("触る前は D に手がかりを付け、D を押すと空いた場所へ移すこと", () => {
      const before = readHintTarget();
      fireEvent.click(getLetter("D に 8"));

      expect([before, readHintTarget()]).toEqual(["D に 8", "8 の札の場所"]);
    });

    test("D を押してから空いた場所を押すと、札が並びへ戻ること", () => {
      fireEvent.click(getLetter("D に 8"));
      fireEvent.click(
        getCardRow().getByRole("button", { name: "8 の札の場所" }),
      );

      expect([
        getEquation().queryAllByRole("button", { name: "D に 8" }).length,
        getCardRow().queryByRole("button", { name: "8 の札" }) !== null,
      ]).toEqual([0, true]);
    });

    test("D から札の並びへ運ぶと、札が並びへ戻ること", () => {
      dragByTouch(
        getLetter("D に 8"),
        getCardRow().getByRole("button", { name: "7 の札" }),
      );

      expect(
        getEquation().queryAllByRole("button", { name: "D に 8" }),
      ).toEqual([]);
    });
  });

  describe("× を付け外しする例の場合", () => {
    beforeEach(() => {
      renderExample(crossOperationExample);
    });

    test("触る前は U に手がかりを付けること", () => {
      expect(readHintTarget()).toBe("U");
    });

    test("U を押してから 5 の札を押すと × が付き、もう一度押すと外れること", () => {
      fireEvent.click(getLetter("U"));
      fireEvent.click(getCardRow().getByRole("button", { name: "5 の札" }));
      const crossed = getCardRow().queryByRole("button", {
        name: "5 の札（×）",
      });
      fireEvent.click(crossed!);

      expect([
        crossed !== null,
        getCardRow().queryByRole("button", { name: "5 の札（×）" }),
      ]).toEqual([true, null]);
    });
  });

  describe("× を付けた文字を選ぶ例の場合", () => {
    beforeEach(() => {
      renderExample(crossShownOperationExample);
    });

    test("0〜9 の札を全部見せ、U に手がかりを付けること", () => {
      expect([listCardNames().length, readHintTarget()]).toEqual([
        10,
        "U（候補 7）",
      ]);
    });

    test("U を押すと × を付けた札に × を出し、手がかりを消すこと", () => {
      fireEvent.click(getLetter("U（候補 7）"));

      expect([
        listCardNames().filter((name) => name?.endsWith("（×）")),
        readHintTarget(),
      ]).toEqual([["5 の札（×）", "6 の札（×）", "7 の札（×）"], null]);
    });

    test("U を選んで式と札の外を押すと、選ぶのをやめて × を消すこと", () => {
      fireEvent.click(getLetter("U（候補 7）"));
      fireEvent.pointerDown(document.body);

      expect(listCardNames().filter((name) => name?.endsWith("（×）"))).toEqual(
        [],
      );
    });
  });

  describe("先頭の0の例の場合", () => {
    beforeEach(() => {
      renderExample(leadingZeroRuleExamples[0]);
    });

    test("D が空なので途中と言い、8 の札に手がかりを付けること", () => {
      expect([readVerdict(), readHintTarget()]).toEqual(["途中", "8 の札"]);
    });

    test("手がかりのとおり D に 8 を入れると、できると言うこと", () => {
      fireEvent.click(getCardRow().getByRole("button", { name: "8 の札" }));
      fireEvent.click(getLetter("D"));

      expect(readVerdict()).toBe("できる");
    });
  });

  describe("足し算の例の場合", () => {
    beforeEach(() => {
      renderExample(sumRuleExamples[0]);
    });

    test("R が空なので途中と言い、9 の札に手がかりを付けること", () => {
      expect([readVerdict(), readHintTarget()]).toEqual(["途中", "9 の札"]);
    });

    test("手がかりのとおり R に 9 を入れると、合うと言うこと", () => {
      fireEvent.click(getCardRow().getByRole("button", { name: "9 の札" }));
      fireEvent.click(getLetter("R"));

      expect(readVerdict()).toBe("合う");
    });

    test("R に 7 を入れると、十の位に本番と同じ計算違いの線を引いて合わないと言うこと", () => {
      fireEvent.click(getCardRow().getByRole("button", { name: "7 の札" }));
      fireEvent.click(getLetter("R"));

      expect([
        hasClassTokens(
          getLetter("D に 8").closest("[role=group]")!,
          fukumenzanToneClassNames.noticeLine,
        ),
        readVerdict(),
      ]).toEqual([true, "合わない"]);
    });
  });

  test("先頭の文字に 0 を入れた盤面では、その札を本番と同じ赤で描くこと", () => {
    renderExample({ ...leadingZeroRuleExamples[0], placed: { M: 1, D: 0 } });

    expect(
      getEquation()
        .getAllByRole("button", { name: "D に 0" })
        .some((tile) => hasClassTokens(tile, fukumenzanToneClassNames.notice)),
    ).toBe(true);
  });

  describe("元に戻すボタン", () => {
    const examples = {
      札を入れる: placeOperationExample,
      同じ文字: sameLetterRuleExample,
      入れ替える: replaceOperationExample,
      運ぶ: moveOperationExample,
      戻す: returnOperationExample,
      "× を付ける": crossOperationExample,
      "× を出す": crossShownOperationExample,
      先頭の0: leadingZeroRuleExamples[0],
      足し算: sumRuleExamples[0],
    } as const satisfies Record<string, FukumenzanHowToPlayExample>;

    test.each(Object.entries(examples))(
      "%s の例では、触る前は押せず、盤面を変えると押せること",
      (_, example) => {
        renderExample(example);
        const before = isResetShown();
        fireEvent.click(getCardRow().getAllByRole("button")[0]!);
        fireEvent.click(
          getEquation().getAllByRole("button", { name: /^[A-Z]/ })[0]!,
        );

        expect([before, isResetShown()]).toEqual([false, true]);
      },
    );
  });
});

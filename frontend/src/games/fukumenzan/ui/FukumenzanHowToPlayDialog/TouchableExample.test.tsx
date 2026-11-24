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
  dragOperationExample,
  leadingZeroRuleExamples,
  sumRuleExamples,
  tapOperationExample,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-definitions";
import { TouchableExample } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/TouchableExample";
import { playSound, type SoundEffect } from "@/lib/audio/sound-effects";

vi.mock("@/lib/audio/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

/** クリア演出の動き。動かした要素を記録し、すぐ終える。 */
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

function getFigures(): HTMLElement[] {
  return screen.getAllByRole("figure");
}

function getEquation(figure = getFigures()[0]!) {
  return within(within(figure).getByRole("group", { name: "式" }));
}

function getCardRow(figure = getFigures()[0]!) {
  return within(within(figure).getByRole("group", { name: "札" }));
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

/** 指で札を運んで、落とし先の上で離す。落とし先は指の下の要素として返す。 */
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
  describe("札を押してから文字を押す例の場合", () => {
    beforeEach(() => {
      renderInPanel(<TouchableExample example={tapOperationExample} />);
    });

    test("触る前は札の列の 5〜9 の段だけを見せること", () => {
      expect(
        getCardRow()
          .getAllByRole("button")
          .map((card) => card.getAttribute("aria-label")),
      ).toEqual(["5 の札", "6 の札", "7 の札", "8 の札", "9 の札"]);
    });

    test("触る前は 8 の札に手がかりを付けること", () => {
      expect(readHintTarget()).toBe("8 の札");
    });

    test("札を押すと手がかりを D へ移すこと", () => {
      fireEvent.click(getCardRow().getByRole("button", { name: "8 の札" }));

      expect(readHintTarget()).toBe("D");
    });

    describe("札を押してから D を押した場合", () => {
      beforeEach(() => {
        fireEvent.click(getCardRow().getByRole("button", { name: "8 の札" }));
        fireEvent.click(
          getEquation().getAllByRole("button", { name: "D" })[0]!,
        );
      });

      test("D の全部の場所に 8 が入ること", () => {
        expect(
          getEquation().getAllByRole("button", { name: "D に 8" }),
        ).toHaveLength(4);
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

      test("手がかりを消すこと", () => {
        expect(readHintTarget()).toBeNull();
      });

      test("元に戻すボタンを出すこと", () => {
        expect(isResetShown()).toBe(true);
      });

      test("元に戻すと触る前の姿と手がかりに戻ること", () => {
        fireEvent.click(screen.getByRole("button", { name: "例を元に戻す" }));

        expect([
          getEquation().queryAllByRole("button", { name: "D に 8" }).length,
          readHintTarget(),
        ]).toEqual([0, "8 の札"]);
      });
    });
  });

  describe("札を運ぶ例の場合", () => {
    test("押すだけの空の文字と空いた場所では指のスクロールを止めず、札では止めること", () => {
      renderInPanel(<TouchableExample example={dragOperationExample} />);

      expect([
        getEquation()
          .getAllByRole("button", { name: "D" })[0]!
          .classList.contains("touch-manipulation"),
        getCardRow()
          .getByRole("button", { name: "8 の札" })
          .classList.contains("touch-none"),
      ]).toEqual([true, true]);
    });

    test("札を D へ運ぶと D の全部の場所に入ること", () => {
      renderInPanel(<TouchableExample example={dragOperationExample} />);

      dragByTouch(
        getCardRow().getByRole("button", { name: "8 の札" }),
        getEquation().getAllByRole("button", { name: "D" })[1]!,
      );

      expect(
        getEquation().getAllByRole("button", { name: "D に 8" }),
      ).toHaveLength(4);
    });

    test("ほかの例の文字の上で離しても札を入れないこと", () => {
      render(
        <>
          <HowToPlayExamplePanel resettable>
            <TouchableExample example={dragOperationExample} />
          </HowToPlayExamplePanel>
          <HowToPlayExamplePanel resettable>
            <TouchableExample example={tapOperationExample} />
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
  });

  describe("先頭の0の例の場合", () => {
    test("できる形の例は、D が空なので途中と言い、8 の札に手がかりを付けること", () => {
      renderInPanel(<TouchableExample example={leadingZeroRuleExamples[0]} />);

      expect([readVerdict(), readHintTarget()]).toEqual(["途中", "8 の札"]);
    });

    test("できる形の例で手がかりのとおり D に 8 を入れると、できると言うこと", () => {
      renderInPanel(<TouchableExample example={leadingZeroRuleExamples[0]} />);

      fireEvent.click(getCardRow().getByRole("button", { name: "8 の札" }));
      fireEvent.click(getEquation().getAllByRole("button", { name: "D" })[0]!);

      expect(readVerdict()).toBe("できる");
    });

    test("できない形の例はできないと言い、手がかりを付けないこと", () => {
      renderInPanel(<TouchableExample example={leadingZeroRuleExamples[1]} />);

      expect([readVerdict(), readHintTarget()]).toEqual(["できない", null]);
    });
  });

  describe("足し算の例の場合", () => {
    test("合う形の例は、R が空なので途中と言い、9 の札に手がかりを付けること", () => {
      renderInPanel(<TouchableExample example={sumRuleExamples[0]} />);

      expect([readVerdict(), readHintTarget()]).toEqual(["途中", "9 の札"]);
    });

    test("合う形の例で手がかりのとおり R に 9 を入れると、合うと言うこと", () => {
      renderInPanel(<TouchableExample example={sumRuleExamples[0]} />);

      fireEvent.click(getCardRow().getByRole("button", { name: "9 の札" }));
      fireEvent.click(getEquation().getByRole("button", { name: "R" }));

      expect(readVerdict()).toBe("合う");
    });

    test("合わない形の例で R に 9 を入れると合うと言うこと", () => {
      renderInPanel(<TouchableExample example={sumRuleExamples[1]} />);

      fireEvent.click(getCardRow().getByRole("button", { name: "9 の札" }));
      fireEvent.click(getEquation().getByRole("button", { name: "R に 7" }));

      expect(readVerdict()).toBe("合う");
    });
  });
});

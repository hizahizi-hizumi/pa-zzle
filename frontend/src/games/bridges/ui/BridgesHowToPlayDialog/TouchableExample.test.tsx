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
import type { BridgesBoard } from "@/games/bridges/puzzle/board";
import {
  countRuleExamples,
  crossingOperationExample,
  crossingRuleExample,
  cycleOperationExample,
  pairOperationExample,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/figure-boards";
import { TouchableExample } from "@/games/bridges/ui/BridgesHowToPlayDialog/TouchableExample";
import { getBridgesHintPlacement } from "@/games/bridges/ui/BridgesHowToPlayDialog/TouchableExample/hint-placement";
import { createBoardView } from "@/games/bridges/ui/board/board-geometry";
import { BLOCKED_REACTION_MS } from "@/games/bridges/ui/board/flash-blocking-bridges";
import {
  playLayeredSound,
  playSound,
  type SoundEffect,
} from "@/lib/audio/sound-effects";

vi.mock("@/lib/audio/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

/** 盤面の動き。動かした要素を記録し、すぐ終える。 */
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
  vi.useRealTimers();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
  Reflect.deleteProperty(Element.prototype, "animate");
});

/** 本番と同じく、元に戻すボタンを持つ例の面に置いて描く。 */
function renderInPanel(example: ReactElement): void {
  render(<HowToPlayExamplePanel resettable>{example}</HowToPlayExamplePanel>);
}

function getFigure(): HTMLElement {
  return screen.getByRole("figure");
}

/** 例の図の、今見えている言葉。図は添えた言葉で呼ばれ、見せない言葉は読み上げから外している。 */
function readCaption(): string {
  let caption = "";
  screen.getByRole("figure", {
    name: (name) => {
      caption = name;
      return true;
    },
  });
  return caption;
}

function getBoardGroup(): HTMLElement {
  return within(getFigure()).getByRole("group", { name: /盤面/ });
}

/** 盤面の島のボタンの読み上げ名。本番の盤面部品が付ける。 */
function listIslandNames(): string[] {
  return within(getBoardGroup())
    .getAllByRole("button")
    .map((button) => button.textContent ?? "");
}

let placedBoard: BridgesBoard | null = null;

/** 盤面を、マス1つ 100px で置く。 */
function placeBoard(board: BridgesBoard): void {
  placedBoard = board;
  const view = createBoardView(board);
  vi.spyOn(getBoardGroup(), "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, view.width * 100, view.height * 100),
  );
}

function toPointer([x, y]: readonly [number, number]) {
  const margin = createBoardView(placedBoard!).margin;
  return {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: (x + margin) * 100,
    clientY: (y + margin) * 100,
  };
}

/** 盤面の上の点（マス幅を 1、左上のマスの左上の角を原点）を押して離す。 */
function press(at: readonly [number, number]): void {
  fireEvent.pointerDown(getBoardGroup(), toPointer(at));
  fireEvent.pointerUp(getBoardGroup(), toPointer(at));
}

/** 交差のルールの例の、手がかりの指先の所（盤面の上の点）。 */
function readFingertip(board: BridgesBoard): readonly [number, number] {
  const view = createBoardView(board);
  const { x, y } = getBridgesHintPlacement(view, crossingRuleExample.hints[0]!)
    .fingertip!;
  return [x - view.margin, y - view.margin];
}

function readHintKind(): string | null {
  return (
    getFigure().querySelector("[data-hint]")?.getAttribute("data-hint") ?? null
  );
}

function listCandidateVerdicts(): string[] {
  return Array.from(
    getFigure().querySelectorAll("[data-candidate-edge]"),
    (mark) => mark.getAttribute("data-candidate-verdict") ?? "",
  ).sort();
}

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

describe("TouchableExample", () => {
  describe("数字と同じ本数のルールのできない形の場合", () => {
    beforeEach(() => {
      renderInPanel(
        <TouchableExample example={countRuleExamples[1]} caption="count" />,
      );
      placeBoard(countRuleExamples[1].board);
    });

    test("✕ 多すぎ と判定し、島に本番と同じ読み上げ名を付けること", () => {
      const caption = readCaption();
      const names = listIslandNames();

      expect(caption).toBe("多すぎ");
      expect(names).toEqual([
        "1行1列の島 数字2 橋1本",
        "1行3列の島 数字3 橋3本 ちょうど",
        "3行3列の島 数字1 橋2本 多すぎ",
      ]);
    });

    test("多すぎの橋を押して外すと、途中になり、本番と同じ外す音を鳴らして元に戻すボタンを出すこと", () => {
      press([2.5, 1.5]);

      expect(readCaption()).toBe("途中");
      expect(playLayeredSound).toHaveBeenCalledOnce();
      expect(isResetShown()).toBe(true);
    });

    describe("多すぎの橋を外した後の場合", () => {
      beforeEach(() => {
        press([2.5, 1.5]);
      });

      test("元に戻すと、最初の姿に戻してボタンを隠すこと", () => {
        fireEvent.click(screen.getByRole("button", { name: "例を元に戻す" }));

        expect(readCaption()).toBe("多すぎ");
        expect(isResetShown()).toBe(false);
      });
    });

    describe("3と1の間を1本にした後の場合", () => {
      beforeEach(() => {
        press([2.5, 1.5]);
        press([2.5, 1.5]);
      });

      test("2と3の間を2本にして完成させると、✓ ちょうど と判定し、どの島もちょうどになること", () => {
        press([1.5, 0.5]);

        expect(readCaption()).toBe("ちょうど");
        expect(
          listIslandNames().every((name) => name.endsWith("ちょうど")),
        ).toBe(true);
      });
    });

    describe("完成させた後の場合", () => {
      let completedNames: string[];

      beforeEach(() => {
        press([2.5, 1.5]);
        press([2.5, 1.5]);
        press([1.5, 0.5]);
        completedNames = listIslandNames();
      });

      test("本番と同じく受け付けず、押しても橋を変えないこと", () => {
        press([1.5, 0.5]);

        expect(listIslandNames()).toEqual(completedNames);
      });
    });
  });

  describe("数字と同じ本数のルールのできる形の場合", () => {
    beforeEach(() => {
      renderInPanel(
        <TouchableExample example={countRuleExamples[0]} caption="count" />,
      );
      placeBoard(countRuleExamples[0].board);
    });

    test("✓ ちょうど と判定し、完成した盤面として押しても変えず音も鳴らさないこと", () => {
      press([1.5, 0.5]);

      expect(readCaption()).toBe("ちょうど");
      expect(playLayeredSound).not.toHaveBeenCalled();
      expect(isResetShown()).toBe(false);
    });
  });

  describe("交差のルールの例の場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      renderInPanel(
        <TouchableExample example={crossingRuleExample} caption="crossing" />,
      );
      placeBoard(crossingRuleExample.board);
    });

    test("触る前は、阻まれる線に手がかりを付け、✓ と ✕ の印と凡例を出すこと", () => {
      const hint = readHintKind();
      const verdicts = listCandidateVerdicts();
      const caption = readCaption();

      expect(hint).toBe("edge");
      expect(verdicts).toEqual(["allowed", "disallowed"]);
      expect(caption).toBe("架けられる、架けられない");
    });

    test("送る画面に置くので、盤面の全体ではスクロールを止めず、島の上だけで止めること", () => {
      const surface = getBoardGroup();
      const islandLocks = surface.querySelectorAll("[data-touch-scroll-lock]");

      expect(surface.classList.contains("touch-none")).toBe(false);
      expect(islandLocks).toHaveLength(
        crossingRuleExample.board.islands.length,
      );
    });

    test("手がかりの指先の所を押すと、本番と同じく阻まれること", () => {
      press(readFingertip(crossingRuleExample.board));

      expect(readCaption()).toBe("架けられない");
    });

    test("✓ の線に 1本 → 2本 → なし と押して最初の形に戻ると、凡例を出し直すこと", () => {
      press([2.5, 0.5]);
      press([2.5, 0.5]);
      press([2.5, 0.5]);

      expect(readCaption()).toBe("架けられる、架けられない");
      expect(readHintKind()).toBe("edge");
    });

    test("線が交差する所を押すと、どちらの橋か決まらなかったと言うこと", () => {
      press([1.5, 2.5]);

      expect(readCaption()).toBe("どちらの橋か決まらない");
    });

    test("手がかりの線を押すと、本番と同じ阻まれた音と反応を返し、手がかりを消して ✕ 架けられない と言うこと", () => {
      press([1.5, 1.2]);

      expect(listPlayedSoundUrls()).toHaveLength(1);
      expect(listPlayedSoundUrls()[0]).toMatch(/blocked/);
      expect(readHintKind()).toBeNull();
      expect(readCaption()).toBe("架けられない");
      expect(isResetShown()).toBe(false);
    });

    test("阻まれた反応を見せている間だけ、その線の印を消すこと", () => {
      press([1.5, 1.2]);
      const during = listCandidateVerdicts();
      act(() => {
        vi.advanceTimersByTime(BLOCKED_REACTION_MS);
      });

      expect(during).toEqual(["allowed"]);
      expect(listCandidateVerdicts()).toEqual(["allowed", "disallowed"]);
    });

    test("✓ の線に架けると、架けられたと言い、印を出し直すこと", () => {
      press([2.5, 0.5]);

      expect(readCaption()).toBe("架けられた");
      expect(listCandidateVerdicts()).toEqual(["disallowed"]);
    });

    test("✓ の線に2本架けると、多すぎの島ができたことを添えること", () => {
      press([2.5, 0.5]);
      press([2.5, 0.5]);

      expect(readCaption()).toBe("架けられた・多すぎの島");
    });
  });

  describe("島の間を押す操作の例の場合", () => {
    beforeEach(() => {
      renderInPanel(<TouchableExample example={cycleOperationExample} />);
      placeBoard(cycleOperationExample.board);
    });

    test("押すたびに橋が回り、手がかりを付け直し、なしに戻るとボタンを隠すこと", () => {
      press([1.5, 0.5]);
      const afterOnce = [readHintKind(), isResetShown()];
      press([1.5, 0.5]);
      press([1.5, 0.5]);

      expect(afterOnce).toEqual(["edge", true]);
      expect(readHintKind()).toBe("edge");
      expect(isResetShown()).toBe(false);
      expect(playLayeredSound).toHaveBeenCalledTimes(3);
    });
  });

  describe("島を選んでから相手の島を押す操作の例の場合", () => {
    beforeEach(() => {
      renderInPanel(<TouchableExample example={pairOperationExample} />);
      placeBoard(pairOperationExample.board);
    });

    test("触る前は、島を選ぶ手がかりを付けること", () => {
      const hint = readHintKind();

      expect(hint).toBe("select");
    });

    test("島を押すと、相手の島を押す手がかりへ移すこと", () => {
      press([2.5, 0.5]);

      expect(readHintKind()).toBe("pair");
    });

    test("相手の島を押すと、橋を架けて手がかりを消すこと", () => {
      press([2.5, 0.5]);
      press([2.5, 2.5]);

      expect(readHintKind()).toBeNull();
      expect(listIslandNames()[1]).toBe("1行3列の島 数字3 橋1本");
    });
  });

  describe("線が交差する所を押す操作の例の場合", () => {
    beforeEach(() => {
      renderInPanel(<TouchableExample example={crossingOperationExample} />);
      placeBoard(crossingOperationExample.board);
    });

    test("交差する所を押すと、橋を変えずに、なぞる手の手がかりへ移すこと", () => {
      const before = listIslandNames();
      press([1.5, 1.5]);

      expect(readHintKind()).toBe("drag");
      expect(listIslandNames()).toEqual(before);
      expect(isResetShown()).toBe(false);
    });
  });
});

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { Mock } from "vitest";

import {
  REFLECTION_SCORE_MAXIMUMS,
  REFLECTION_SPEED_ZERO_SCORE_RATIO,
} from "@/games/reflection/score";
import { ReflectionHowToPlayDialog } from "@/games/reflection/ui/ReflectionHowToPlayDialog";

vi.mock("@/lib/audio/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

function getDialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "リフレクションの遊び方" });
}

function openTab(name: string): HTMLElement {
  fireEvent.mouseDown(within(getDialog()).getByRole("tab", { name }));
  fireEvent.click(within(getDialog()).getByRole("tab", { name }));
  return within(getDialog()).getByRole("tabpanel", { name });
}

function readHeadings(panel: HTMLElement, level: number): string[] {
  return within(panel)
    .getAllByRole("heading", { level })
    .map((heading) => heading.textContent ?? "");
}

function pressEscape(): void {
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: "Escape",
  });
}

describe("ReflectionHowToPlayDialog", () => {
  let onOpenTutorial: Mock<() => void>;
  let onClose: Mock<() => void>;

  beforeEach(() => {
    onOpenTutorial = vi.fn();
    onClose = vi.fn();
    render(
      <ReflectionHowToPlayDialog
        open
        onClose={onClose}
        onOpenTutorial={onOpenTutorial}
      />,
    );
  });

  describe("操作の例でピースを選んだ場合", () => {
    let piece: HTMLElement;

    beforeEach(() => {
      const panel = openTab("操作");
      const [, moveExampleBoard] = within(panel).getAllByRole("group", {
        name: "リフレクション盤面",
      });
      piece = within(moveExampleBoard as HTMLElement).getByRole("button", {
        name: "1行1列 右上がりの鏡",
      });
      fireEvent.click(piece);
    });

    test("本番と同じく、Esc で層を閉じずに選んだピースを解くこと", () => {
      pressEscape();

      const result = {
        pressed: piece.getAttribute("aria-pressed"),
        closed: onClose.mock.calls.length,
      };

      expect(result).toEqual({ pressed: "false", closed: 0 });
    });

    test("選びを解いた後の Esc で、層を閉じること", () => {
      pressEscape();
      pressEscape();

      const closed = onClose.mock.calls.length;

      expect(closed).toBe(1);
    });
  });

  test("何をするパズルかを一文で言うこと", () => {
    const description = within(getDialog()).getByText(
      "外周の数字どおりに光が進むように手持ちのピースをすべて盤面に置くパズルです。",
    );

    expect(description).toBeTruthy();
  });

  test("ルールを、光の合わせ方・ピースの働き・完成の順に並べること", () => {
    const panel = within(getDialog()).getByRole("tabpanel", {
      name: "ルール",
    });

    const headings = readHeadings(panel, 3);

    expect(headings).toEqual([
      "数字から入れた光がその数だけマスを通り印のとおりに進むようにピースを置きます。合った数字は緑になります。",
      "別の所から出る光は出た先の数字も同じ数字にそろえます。",
      "斜め鏡は光を直角に曲げます。",
      "反射鏡はどの向きの光もはね返します。戻る分のマスも数えます。",
      "両面鏡は鏡に沿って進む光をそのまま通します。正面から当たる光ははね返します。",
      "ブラックホールは光を吸い込みます。ブラックホールのマスまで数えます。",
      "手持ちのピースをすべて置いてどの数字も緑になれば完成です。",
    ]);
  });

  test("操作を、置き方・光路・やり直し・キーボードのまとまりに分けること", () => {
    const panel = openTab("操作");

    const headings = readHeadings(panel, 3);

    expect(headings).toEqual(["置き方", "光路", "やり直し", "キーボード"]);
  });

  test("採点を、結果画面と同じく速さの満点と点に入らないものに分け、0点になる倍率を言うこと", () => {
    const panel = openTab("採点");

    const lead = within(panel).getByText(
      (_, element) =>
        element?.tagName === "P" &&
        element.textContent ===
          `問題ごとの基準時間以内なら満点です。超えると点が下がります。基準時間の${REFLECTION_SPEED_ZERO_SCORE_RATIO}倍かかると0点です。`,
    );
    const headings = readHeadings(panel, 3);

    expect(headings).toEqual([
      `速さ ${REFLECTION_SCORE_MAXIMUMS.speed}点`,
      "点に入らないもの",
    ]);
    expect(lead).toBeTruthy();
  });

  test("チュートリアルを始められること", () => {
    fireEvent.click(
      within(getDialog()).getByRole("button", {
        name: "チュートリアルで遊んで覚える",
      }),
    );

    expect(onOpenTutorial).toHaveBeenCalledTimes(1);
  });
});

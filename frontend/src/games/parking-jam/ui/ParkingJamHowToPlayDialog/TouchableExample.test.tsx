import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { HowToPlayExamplePanel } from "@/components/HowToPlayExamplePanel";
import {
  carRuleExample,
  type ParkingJamHowToPlayExample,
  planterRuleExample,
  roadRuleExample,
  straightRuleExample,
  swipeOperationExample,
  tapOperationExample,
} from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-boards";
import { TouchableExample } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/TouchableExample";
import { playSound, type SoundEffect } from "@/lib/audio/sound-effects";
import { prefersReducedMotion } from "@/lib/motion";

vi.mock("@/lib/audio/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion")>()),
  prefersReducedMotion: vi.fn(() => false),
}));

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.mocked(prefersReducedMotion).mockReturnValue(false);
});

/** 本番と同じく、元に戻すボタンを持つ例の面に置いて描く。 */
function renderInPanel(
  example: ParkingJamHowToPlayExample,
  judged: boolean,
): void {
  render(
    <HowToPlayExamplePanel resettable>
      <TouchableExample example={example} judged={judged} />
    </HowToPlayExamplePanel>,
  );
}

function getCar(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

/** 本番の盤面と同じく、車を押したまま `dx`・`dy` だけ動かして離す。動かさなければ押しただけになる。 */
function swipe(car: HTMLElement, dx: number, dy: number): void {
  fireEvent.pointerDown(car, { pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerUp(car, {
    pointerId: 1,
    clientX: 100 + dx,
    clientY: 100 + dy,
  });
}

/** 車の端の印。`車:向き` ごとに、出られるか。 */
function readMarks(): Record<string, boolean> {
  return Object.fromEntries(
    screen
      .queryAllByTestId("move-mark")
      .map((mark) => [
        mark.getAttribute("data-move-mark"),
        mark.getAttribute("data-allowed") === "true",
      ]),
  );
}

/** 押す所の手がかり。付いていなければ `null`。 */
function readHint(): {
  vehicle: string | null;
  target: string | null;
  swipe: string | null;
} | null {
  const hint = screen.queryByTestId("board-hint");
  if (hint === null) {
    return null;
  }
  return {
    vehicle: hint.getAttribute("data-hinted-vehicle"),
    target: hint.getAttribute("data-hint-target"),
    swipe: hint.getAttribute("data-swipe-direction"),
  };
}

/** 例の下に添えた、出られるかの言葉。添えていなければ `null`。 */
function queryCaptionWords(): HTMLElement | null {
  return within(screen.getByRole("figure")).queryByText(/出られ/);
}

function queryFigure(name: string): HTMLElement | null {
  return screen.queryByRole("figure", { name });
}

/** 鳴らした音ごとの、鳴らすまでの待ち。 */
function readSounds(): { sound: string; delayMs: number | undefined }[] {
  return vi.mocked(playSound).mock.calls.map(([sound, options]) => {
    const { url } = sound as SoundEffect & { url: string };
    return {
      sound: url.includes("blocked")
        ? "blocked"
        : url.includes("exited")
          ? "exited"
          : url,
      delayMs: (options as { delayMs?: number } | undefined)?.delayMs,
    };
  });
}

function listSoundNames(): string[] {
  return readSounds().map(({ sound }) => sound);
}

function isResetVisible(): boolean {
  return !screen.getByRole<HTMLButtonElement>("button", {
    name: "例を元に戻す",
  }).disabled;
}

const legendName = "出られる、出られない";
const roadCar = "横向きの車 行1 列1";

describe("TouchableExample", () => {
  describe("前か後ろへのルールの例の場合", () => {
    const car = "縦向きの車 行1 列2";

    beforeEach(() => {
      renderInPanel(straightRuleExample, true);
    });

    test("車の上下の端に出られる印を付け、凡例を添え、下へ出す手に手がかりを付けること", () => {
      const marks = readMarks();
      const figure = queryFigure("出られる");
      const hint = readHint();

      expect(marks).toEqual({ "a:up": true, "a:down": true });
      expect(figure).not.toBeNull();
      expect(hint).toEqual({ vehicle: "a", target: "vehicle", swipe: "down" });
    });

    test("下へスワイプすると、本番と同じく車を出して出る音を鳴らし、出た向きを言い、印と手がかりを消して元に戻すを出すこと", () => {
      swipe(getCar(car), 0, 60);

      const sounds = listSoundNames();
      const figure = queryFigure("下へ出られた");
      const marks = readMarks();
      const hint = readHint();
      const resetVisible = isResetVisible();

      expect(sounds).toEqual(["exited"]);
      expect(figure).not.toBeNull();
      expect(marks).toEqual({});
      expect(hint).toBeNull();
      expect(resetVisible).toBe(true);
    });

    test("車を押すと、本番と同じく両端に矢印を出したまま、印と凡例を残すこと", () => {
      swipe(getCar(car), 0, 0);

      const arrows = screen
        .getAllByRole("button", { name: /へ出庫$/ })
        .map((arrow) => arrow.getAttribute("aria-label"));
      const marks = readMarks();
      const figure = queryFigure("出られる");

      expect(arrows).toEqual(["上へ出庫", "下へ出庫"]);
      expect(marks).toEqual({ "a:up": true, "a:down": true });
      expect(figure).not.toBeNull();
    });
  });

  describe("道路のルールの例の場合", () => {
    beforeEach(() => {
      renderInPanel(roadRuleExample, true);
    });

    test("車の両端に本番の判定で出られるかの印を付け、印の凡例を添え、出られない右へ出す手に手がかりを付けること", () => {
      const marks = readMarks();
      const figure = queryFigure(legendName);
      const hint = readHint();

      expect(marks).toEqual({ "a:left": true, "a:right": false });
      expect(figure).not.toBeNull();
      expect(hint).toEqual({ vehicle: "a", target: "vehicle", swipe: "right" });
    });

    test("右へスワイプすると、本番と同じく車を当てて揺らし当たる音を鳴らし、試した向きと出られないわけを添えて手がかりを消し、元に戻すを出さないこと", () => {
      swipe(getCar(roadCar), 60, 0);

      const shaken = getCar(roadCar).classList.contains(
        "parking-jam-car--blocked-right",
      );
      const sounds = listSoundNames();
      const figure = queryFigure("右へ出られない・進む先に道路がない");
      const hint = readHint();
      const resetVisible = isResetVisible();

      expect(shaken).toBe(true);
      expect(sounds).toEqual(["blocked"]);
      expect(figure).not.toBeNull();
      expect(hint).toBeNull();
      expect(resetVisible).toBe(false);
    });

    test("左へスワイプすると、本番と同じく車を出して出る音を鳴らし、出た向きを言い、印と手がかりを消して元に戻すを出すこと", () => {
      swipe(getCar(roadCar), -60, 0);

      const sounds = listSoundNames();
      const figure = queryFigure("左へ出られた");
      const marks = readMarks();
      const hint = readHint();
      const resetVisible = isResetVisible();

      expect(sounds).toEqual(["exited"]);
      expect(figure).not.toBeNull();
      expect(marks).toEqual({});
      expect(hint).toBeNull();
      expect(resetVisible).toBe(true);
    });

    describe("車を出した後の場合", () => {
      beforeEach(() => {
        swipe(getCar(roadCar), -60, 0);
      });

      test("元に戻すと、最初の姿に戻ること", () => {
        fireEvent.click(screen.getByRole("button", { name: "例を元に戻す" }));

        const marks = readMarks();
        const hint = readHint();
        const resetVisible = isResetVisible();

        expect(marks).toEqual({ "a:left": true, "a:right": false });
        expect(hint).toEqual({
          vehicle: "a",
          target: "vehicle",
          swipe: "right",
        });
        expect(resetVisible).toBe(false);
      });
    });

    describe("右へ当てた後の場合", () => {
      beforeEach(() => {
        swipe(getCar(roadCar), 60, 0);
      });

      test("車を押して矢印を出すと、印の凡例に戻し、手がかりを右の矢印に付けること", () => {
        swipe(getCar(roadCar), 0, 0);

        const hint = readHint();
        const figure = queryFigure(legendName);
        const arrows = within(screen.getByRole("figure"))
          .getAllByRole("button", { name: /へ出庫$/ })
          .map((arrow) => arrow.getAttribute("aria-label"));

        expect(hint).toEqual({ vehicle: "a", target: "arrow", swipe: null });
        expect(figure).not.toBeNull();
        expect(arrows).toEqual(["左へ出庫", "右へ出庫"]);
      });
    });
  });

  describe("植え込みのルールの例の場合", () => {
    beforeEach(() => {
      renderInPanel(planterRuleExample, true);
    });

    test("右の端に出られない印を付け、右へ出す手に手がかりを付けること", () => {
      const marks = readMarks();
      const hint = readHint();

      expect(marks).toEqual({ "a:left": true, "a:right": false });
      expect(hint).toEqual({ vehicle: "a", target: "vehicle", swipe: "right" });
    });

    test("右へスワイプすると、植え込みに当たったことを添えること", () => {
      swipe(getCar(roadCar), 60, 0);

      const figure = queryFigure("右へ出られない・植え込みがある");
      const sounds = listSoundNames();

      expect(figure).not.toBeNull();
      expect(sounds).toEqual(["blocked"]);
    });
  });

  describe("ほかの車のルールの例の場合", () => {
    const smallCar = "横向きの車 行2 列1";
    const longCar = "縦向きの車 行1 列4";

    beforeEach(() => {
      renderInPanel(carRuleExample, true);
    });

    test("別のルールで出られない2マスの車の左には印を付けないこと", () => {
      const marks = readMarks();

      expect(marks).toEqual({
        "b:up": true,
        "b:down": true,
        "a:right": false,
      });
    });

    test("2マスの車を右へ出すと、ほかの車に当たったことを添えること", () => {
      swipe(getCar(smallCar), 60, 0);

      const figure = queryFigure("右へ出られない・ほかの車がある");

      expect(figure).not.toBeNull();
    });

    test("2マスの車を左へ出すと、例が教えるルールと別の、道路が無いことを添えること", () => {
      swipe(getCar(smallCar), -60, 0);

      const figure = queryFigure("左へ出られない・進む先に道路がない");

      expect(figure).not.toBeNull();
    });

    test("じゃまな3マスの車を上へ出すと、2マスの車の右を出られる印に替えて凡例を残し、手がかりを2マスの車の右へ出す手に移すこと", () => {
      swipe(getCar(longCar), 0, -60);

      const marks = readMarks();
      const figure = queryFigure("出られる");
      const hint = readHint();

      expect(marks).toEqual({ "a:right": true });
      expect(figure).not.toBeNull();
      expect(hint).toEqual({ vehicle: "a", target: "vehicle", swipe: "right" });
    });
  });

  describe("スワイプで出す操作の例の場合", () => {
    beforeEach(() => {
      renderInPanel(swipeOperationExample, false);
    });

    test("印と言葉を添えず、右へ出す手に手がかりを付け、右へスワイプすると車を出して手がかりを消すこと", () => {
      const before = {
        marks: readMarks(),
        caption: queryCaptionWords(),
        hint: readHint(),
      };
      swipe(getCar(roadCar), 60, 0);

      const hint = readHint();
      const sounds = listSoundNames();

      expect(before).toEqual({
        marks: {},
        caption: null,
        hint: { vehicle: "a", target: "vehicle", swipe: "right" },
      });
      expect(hint).toBeNull();
      expect(sounds).toEqual(["exited"]);
    });
  });

  describe("押して矢印で出す操作の例の場合", () => {
    const car = "縦向きの車 行2 列2";

    beforeEach(() => {
      renderInPanel(tapOperationExample, false);
    });

    test("印と言葉を添えず、車の手がかりにはスワイプの向きを添えないこと", () => {
      const marks = readMarks();
      const caption = queryCaptionWords();
      const hint = readHint();

      expect(marks).toEqual({});
      expect(caption).toBeNull();
      expect(hint).toEqual({ vehicle: "a", target: "vehicle", swipe: null });
    });

    test("車を押すと本番と同じく両端に矢印を出して手がかりを上の矢印へ移し、上の矢印を押すと車を出して手がかりを消すこと", () => {
      swipe(getCar(car), 0, 0);
      const hintAfterSelect = readHint();
      fireEvent.click(screen.getByRole("button", { name: "上へ出庫" }));

      const hintAfterExit = readHint();
      const sounds = listSoundNames();
      const arrows = screen.queryAllByRole("button", { name: /へ出庫$/ });

      expect(hintAfterSelect).toEqual({
        vehicle: "a",
        target: "arrow",
        swipe: null,
      });
      expect(hintAfterExit).toBeNull();
      expect(sounds).toEqual(["exited"]);
      expect(arrows).toEqual([]);
    });
  });

  describe("指で盤面を触る場合", () => {
    /** 指を置いて動かし、動かした所で既定の働き（スクロール）を取り消されたか。 */
    function isScrollBlocked(start: Element): boolean {
      fireEvent.touchStart(start, { touches: [{ clientX: 0, clientY: 0 }] });
      const notCanceled = fireEvent.touchMove(start, {
        touches: [{ clientX: 0, clientY: 40 }],
      });
      fireEvent.touchEnd(start, { touches: [] });
      return !notCanceled;
    }

    beforeEach(() => {
      renderInPanel(tapOperationExample, false);
    });

    test("スクロールを止めるのは、車と矢印の上で始めた動きだけにし、盤面のほかの所で始めた動きでは送れるようにすること", () => {
      const car = getCar("縦向きの車 行2 列2");
      const lot = screen.getByRole("group", { name: "パーキングジャム盤面" });
      const onLot = isScrollBlocked(lot);
      const onCar = isScrollBlocked(car);
      swipe(car, 0, 0);

      const onArrow = isScrollBlocked(
        screen.getByRole("button", { name: "上へ出庫" }),
      );

      expect({ onLot, onCar, onArrow }).toEqual({
        onLot: false,
        onCar: true,
        onArrow: true,
      });
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.mocked(prefersReducedMotion).mockReturnValue(true);
      renderInPanel(roadRuleExample, true);
    });

    test("右へスワイプすると、本番と同じく当たる音を待たずに鳴らし、試した向きと出られないわけを添えること", () => {
      swipe(getCar(roadCar), 60, 0);

      const sounds = readSounds();
      const figure = queryFigure("右へ出られない・進む先に道路がない");

      expect(sounds).toEqual([{ sound: "blocked", delayMs: 0 }]);
      expect(figure).not.toBeNull();
    });
  });
});

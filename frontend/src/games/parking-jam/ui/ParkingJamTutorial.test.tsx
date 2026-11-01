import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { ParkingJamTutorial } from "@/games/parking-jam/ui/ParkingJamTutorial";

/** 盤面の車の読み上げ名。 */
const vehicleLabels = {
  a: "横向きの車 行2 列4",
  b: "横向きの車 行3 列1",
  c: "縦向きの車 行1 列2",
  d: "横向きの車 行4 列1",
  e: "縦向きの車 行4 列3",
  f: "横向きの車 行4 列4",
  g: "横向きの車 行5 列4",
} as const;

type VehicleId = keyof typeof vehicleLabels;

type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

/** 手順ごとに出す車と向き。 */
const stepMoves = [
  ["e", "ArrowUp"],
  ["g", "ArrowRight"],
  ["b", "ArrowLeft"],
  ["c", "ArrowUp"],
] as const satisfies readonly (readonly [VehicleId, ArrowKey])[];

/** 手順を終えた後、残りを出し切る手。 */
const remainingMoves = [
  ["a", "ArrowLeft"],
  ["f", "ArrowRight"],
  ["d", "ArrowRight"],
] as const satisfies readonly (readonly [VehicleId, ArrowKey])[];

/** 車が出ていき終えて盤面から消えてから、次の手順の一言と印を出すまでの間。 */
const exitStepHoldMs = 700;

/** 手を離した後、手が止まってから今出せる車を示すまでの間。 */
const idleHintDelayMs = 4000;

/** 導入の場面の動きを見せ終えるのに十分な間。 */
const introEnoughMs = 8000;

const firstHeadline = "車を出したい向きへ スワイプします";
const roadHeadline = "進む先に道路がないと 出られません";
const carHeadline = "ほかの車があると 通れません";
const freePlayHeadline = "残りの車も出すと完成です";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubReducedMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
}

function advanceTime(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function pressNext(): void {
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
}

/** 場面の動きを待っては「次へ」を押し、導入を最後まで進める。 */
function goThroughIntroSync(): void {
  for (let press = 0; press < 3; press += 1) {
    advanceTime(introEnoughMs);
    const next = screen.queryByRole("button", { name: "次へ" });
    if (!next) {
      return;
    }
    fireEvent.click(next);
  }
  advanceTime(introEnoughMs);
}

/** 導入を飛ばして、最初の手順から始める。 */
function skipIntro(): void {
  fireEvent.pointerDown(screen.getByRole("main"));
}

function queryVehicle(vehicleId: VehicleId): HTMLElement | null {
  return within(screen.getByRole("main")).queryByRole("button", {
    name: vehicleLabels[vehicleId],
  });
}

/** 盤面と同じく、車の向きに沿う矢印キーで動かす。 */
function moveVehicles(
  moves: readonly (readonly [VehicleId, ArrowKey])[],
  holdMs = 0,
): void {
  for (const [vehicleId, key] of moves) {
    const vehicle = queryVehicle(vehicleId);
    if (!vehicle) {
      throw new Error(`車 ${vehicleId} がない`);
    }
    fireEvent.keyDown(vehicle, { key });
    advanceTime(holdMs);
  }
}

/** 当たったものの合図。合図を付けた車と、当たったものの種類。 */
function getContacts(tone: "rejected" | "waiting"): string[][] {
  return Array.from(
    screen.getByRole("main").querySelectorAll(`[data-contact-cue="${tone}"]`),
    (cue) => [
      cue.getAttribute("data-vehicle-id") ?? "",
      cue.getAttribute("data-blocker") ?? "",
    ],
  );
}

/** 合図を付けた車。既定は、次に動かす車の印。 */
function getCuedVehicles(kind: "hint" | "rejected" = "hint"): string[] {
  return Array.from(
    screen.getByRole("main").querySelectorAll(`[data-vehicle-cue="${kind}"]`),
    (cue) => cue.getAttribute("data-vehicle-id") ?? "",
  );
}

/** 次に動かす車の印。印を付け直すと、別の要素に替わる。 */
function queryHintMark(): Element | null {
  return screen.getByRole("main").querySelector('[data-vehicle-cue="hint"]');
}

function getRuleTexts(): string[] {
  return within(screen.getByRole("list", { name: "ルール" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("ParkingJamTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let onStartPlay: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    onStartPlay = vi.fn<() => void>();
  });

  describe("難易度選択から開いた場合", () => {
    beforeEach(() => {
      render(
        <ParkingJamTutorial
          open={true}
          onStartPlay={onStartPlay}
          onClose={onClose}
        />,
      );
      skipIntro();
    });

    test("車の停まった始めの盤面で、最初に動かす車を示し、まだ示していないルールを伏せておくこと", () => {
      const headline = screen.queryByText(firstHeadline);
      const vehicle = queryVehicle("e");
      const cued = getCuedVehicles();
      const rules = getRuleTexts();

      expect(headline).not.toBeNull();
      expect(vehicle).not.toBeNull();
      expect(cued).toEqual(["e"]);
      expect(rules).toEqual([
        "前か後ろへ",
        "伏せたルール",
        "伏せたルール",
        "伏せたルール",
      ]);
    });

    describe("印の無い車を動かした場合", () => {
      let hintMarkBefore: Element | null;

      beforeEach(() => {
        hintMarkBefore = queryHintMark();
      });

      test("受け付けず、警告の色を使わずに、一言を変えないまま印を付け直して光らせること", () => {
        moveVehicles([["g", "ArrowRight"]]);

        const vehicle = queryVehicle("g");
        const headline = screen.queryByText(firstHeadline);
        const rejected = getCuedVehicles("rejected");
        const hintMark = queryHintMark();
        const cued = getCuedVehicles();

        expect(vehicle).not.toBeNull();
        expect(headline).not.toBeNull();
        expect(rejected).toEqual([]);
        expect(hintMark).not.toBe(hintMarkBefore);
        expect(cued).toEqual(["e"]);
      });
    });

    describe("最初の手順の車を出した場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves.slice(0, 1));
      });

      test("出ていく間は、前の一言のまま印を消しておくこと", () => {
        const headline = screen.queryByText(firstHeadline);
        const cued = getCuedVehicles();

        expect(headline).not.toBeNull();
        expect(cued).toEqual([]);
      });

      test("出ていき終えると、次のルールの一言と印を出すこと", () => {
        advanceTime(exitStepHoldMs);

        const headline = screen.queryByText(roadHeadline);
        const cued = getCuedVehicles();
        const rules = getRuleTexts();

        expect(headline).not.toBeNull();
        expect(cued).toEqual(["g"]);
        expect(rules).toEqual([
          "前か後ろへ",
          "道路へ出る",
          "伏せたルール",
          "伏せたルール",
        ]);
      });
    });

    describe("道路のルールの手順の場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves.slice(0, 1), exitStepHoldMs);
      });

      test("進む先に道路がない向きへ動かすと、出さずに、車の縁と当たった縁石で返すこと", () => {
        moveVehicles([["g", "ArrowLeft"]]);

        const vehicle = queryVehicle("g");
        const rejected = getCuedVehicles("rejected");
        const contacts = getContacts("rejected");

        expect(vehicle).not.toBeNull();
        expect(rejected).toEqual(["g"]);
        expect(contacts).toEqual([["g", "wall"]]);
      });

      test("道路のある向きへ出すと、次のルールの一言と印へ進むこと", () => {
        moveVehicles([["g", "ArrowRight"]], exitStepHoldMs);

        const headline = screen.queryByText("植え込みがあると 通れません");
        const cued = getCuedVehicles();

        expect(headline).not.toBeNull();
        expect(cued).toEqual(["b"]);
      });
    });

    describe("植え込みのルールの手順の場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves.slice(0, 2), exitStepHoldMs);
      });

      test("植え込みへ動かすと、当たった植え込みを示すこと", () => {
        moveVehicles([["b", "ArrowRight"]]);

        const contacts = getContacts("rejected");

        expect(contacts).toEqual([["b", "fixed-area"]]);
      });
    });

    describe("ほかの車のルールの手順の場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves.slice(0, 3), exitStepHoldMs);
      });

      test("塞いでいる車に印を付け、塞がれた車の進む先を示すこと", () => {
        const headline = screen.queryByText(carHeadline);
        const cued = getCuedVehicles();
        const waiting = getContacts("waiting");

        expect(headline).not.toBeNull();
        expect(cued).toEqual(["c"]);
        expect(waiting).toEqual([["a", "vehicle"]]);
      });

      test("塞いでいる車を出すと、手を離し、塞がれた車の進む先の合図を消すこと", () => {
        moveVehicles(stepMoves.slice(3), exitStepHoldMs);

        const headline = screen.queryByText(freePlayHeadline);
        const waiting = getContacts("waiting");

        expect(headline).not.toBeNull();
        expect(waiting).toEqual([]);
      });
    });

    describe("手順を終えた場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves, exitStepHoldMs);
      });

      test("残りを出すことを伝え、すべてのルールを見せ、手が止まるまで印を出さないこと", () => {
        const headline = screen.queryByText(freePlayHeadline);
        const rules = getRuleTexts();
        const cued = getCuedVehicles();

        expect(headline).not.toBeNull();
        expect(rules).toEqual([
          "前か後ろへ",
          "道路へ出る",
          "植え込み",
          "ほかの車",
        ]);
        expect(cued).toEqual([]);
      });

      test("手が止まると、今出せる車を1台示すこと", () => {
        advanceTime(idleHintDelayMs);

        const cued = getCuedVehicles();

        expect(cued).toHaveLength(1);
      });

      test("ほかの車がある向きへ動かすと、わけと当たった車を伝えること", () => {
        moveVehicles([["d", "ArrowRight"]]);

        const headline = screen.queryByText(carHeadline);
        const contacts = getContacts("rejected");

        expect(headline).not.toBeNull();
        expect(contacts).toEqual([["d", "vehicle"]]);
      });

      test("途中にほかの車があっても道路につながっていない向きへ動かすと、本番と同じく道路がないことを伝えること", () => {
        moveVehicles([["f", "ArrowLeft"]]);

        const headline = screen.queryByText(roadHeadline);
        const contacts = getContacts("rejected");

        expect(headline).not.toBeNull();
        expect(contacts).toEqual([["f", "wall"]]);
      });

      describe("出られない向きへ動かした後の場合", () => {
        beforeEach(() => {
          moveVehicles([["d", "ArrowRight"]]);
        });

        test("手が止まると、印と一緒に残りを出す一言に戻すこと", () => {
          advanceTime(idleHintDelayMs);

          const headline = screen.queryByText(freePlayHeadline);
          const cued = getCuedVehicles();

          expect(headline).not.toBeNull();
          expect(cued).toHaveLength(1);
        });
      });

      describe("すべて出した場合", () => {
        beforeEach(() => {
          moveVehicles(remainingMoves);
          advanceTime(0);
        });

        test("長い車も同じルールで出せることと、ミスの数え方を伝えること", () => {
          const detail = screen.queryByText(
            "長い車も同じルールで出せます 出られない向きへ動かすとミスに数えます",
          );

          expect(detail).not.toBeNull();
        });

        test("レベル1を遊ぶでレベル1を始めること", () => {
          fireEvent.click(
            screen.getByRole("button", { name: "レベル1を遊ぶ" }),
          );

          expect(onStartPlay).toHaveBeenCalledOnce();
        });

        test("もう一度で、始まりの盤面の一言を見せること", () => {
          fireEvent.click(screen.getByRole("button", { name: "もう一度" }));

          const caption = screen.queryByText("最初は車でいっぱいです");

          expect(caption).not.toBeNull();
        });

        describe("もう一度で導入を終えた場合", () => {
          beforeEach(() => {
            fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
            goThroughIntroSync();
          });

          test("始めの盤面に戻し、最初の手順から始めること", () => {
            const vehicle = queryVehicle("a");
            const cued = getCuedVehicles();
            const rules = getRuleTexts();

            expect(vehicle).not.toBeNull();
            expect(cued).toEqual(["e"]);
            expect(rules).toEqual([
              "前か後ろへ",
              "伏せたルール",
              "伏せたルール",
              "伏せたルール",
            ]);
          });
        });
      });
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      render(<ParkingJamTutorial open={true} onClose={onClose} />);
    });

    test("最初の画面で、何をするパズルかと、車の停まっていた場所を点線で残した空の駐車場を、ゴールの一言と一緒に見せること", () => {
      const purpose = screen.queryByText(
        "駐車場の車を すべて道路へ出すパズルです",
      );
      const caption = screen.queryByText("駐車場が空になったらゴールです");
      const vehicle = queryVehicle("e");
      const ghosts = screen
        .getByRole("main")
        .querySelectorAll("[data-vehicle-ghost]");

      expect(purpose).not.toBeNull();
      expect(caption).not.toBeNull();
      expect(vehicle).toBeNull();
      expect(ghosts).toHaveLength(7);
    });

    test("ゴールで次へを押すと、始まりの一言を添えて車の停まった始めの盤面を見せること", () => {
      pressNext();

      const caption = screen.queryByText("最初は車でいっぱいです");
      const vehicle = queryVehicle("e");

      expect(caption).not.toBeNull();
      expect(vehicle).not.toBeNull();
    });

    describe("導入を終えた場合", () => {
      beforeEach(() => {
        pressNext();
        goThroughIntroSync();
      });

      test("印の車を出すと、待たずに次のルールの一言と印を出すこと", () => {
        moveVehicles(stepMoves.slice(0, 1));

        const headline = screen.queryByText(roadHeadline);
        const cued = getCuedVehicles();

        expect(headline).not.toBeNull();
        expect(cued).toEqual(["g"]);
      });

      describe("道路のルールの手順の場合", () => {
        beforeEach(() => {
          moveVehicles(stepMoves.slice(0, 1));
        });

        test("進む先に道路がない向きへ動かすと、車の縁と当たった縁石で返すこと", () => {
          moveVehicles([["g", "ArrowLeft"]]);

          const rejected = getCuedVehicles("rejected");
          const contacts = getContacts("rejected");

          expect(rejected).toEqual(["g"]);
          expect(contacts).toEqual([["g", "wall"]]);
        });
      });
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<ParkingJamTutorial open={true} onClose={onClose} />);
      skipIntro();
    });

    describe("すべて出した場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves, exitStepHoldMs);
        moveVehicles(remainingMoves);
        advanceTime(0);
      });

      test("ミスの数え方を伝えること", () => {
        const detail = screen.queryByText(
          "出られない向きへ動かすとミスに数えます",
        );

        expect(detail).not.toBeNull();
      });

      test("プレイに戻る操作で閉じること", () => {
        fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

        expect(onClose).toHaveBeenCalledOnce();
      });
    });
  });
});

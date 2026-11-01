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

/** 手順ごとに動かす車と向き。4つ目は車に当てる手。 */
const stepMoves = [
  ["e", "ArrowUp"],
  ["g", "ArrowRight"],
  ["b", "ArrowLeft"],
  ["a", "ArrowLeft"],
  ["c", "ArrowUp"],
] as const satisfies readonly (readonly [VehicleId, ArrowKey])[];

/** 手順を終えた後、残りを出し切る手。 */
const remainingMoves = [
  ["f", "ArrowRight"],
  ["d", "ArrowRight"],
  ["a", "ArrowLeft"],
] as const satisfies readonly (readonly [VehicleId, ArrowKey])[];

/** 車が出ていき終えてから、次の手順の一言と印を出すまでの間。 */
const exitStepHoldMs = 520;

/** 車が当たって止まってから、次の手順の一言と印を出すまでの間。 */
const blockedStepHoldMs = 800;

/** 手を離した後、手が止まってから今出せる車を示すまでの間。 */
const idleHintDelayMs = 4000;

/** 導入の場面の動きを見せ終えるのに十分な間。 */
const introEnoughMs = 8000;

const firstHeadline = "車を出したい向きへ スワイプします";
const roadHeadline = "道路がない向きへは 出られません";
const carHeadline = "車があると通れません";
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

/** 合図を付けた車。既定は、次に動かす車の印。 */
function getCuedVehicles(kind: "hint" | "rejected" = "hint"): string[] {
  return Array.from(
    screen.getByRole("main").querySelectorAll(`[data-vehicle-cue="${kind}"]`),
    (cue) => cue.getAttribute("data-vehicle-id") ?? "",
  );
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
      const headline = screen.getByText(firstHeadline);
      const cued = getCuedVehicles();
      const rules = getRuleTexts();

      expect(headline).toBeTruthy();
      expect(queryVehicle("e")).not.toBeNull();
      expect(cued).toEqual(["e"]);
      expect(rules).toEqual([
        "前か後ろ",
        "伏せたルール",
        "伏せたルール",
        "伏せたルール",
      ]);
    });

    test("印の無い車を動かしても受け付けず、一言を変えずに印を付け直すこと", () => {
      const cueBefore = screen
        .getByRole("main")
        .querySelector('[data-vehicle-cue="hint"]');
      moveVehicles([["g", "ArrowRight"]]);

      const cueAfter = screen
        .getByRole("main")
        .querySelector('[data-vehicle-cue="hint"]');
      const headline = screen.getByText(firstHeadline);

      expect(queryVehicle("g")).not.toBeNull();
      expect(headline).toBeTruthy();
      expect(cueAfter).not.toBe(cueBefore);
      expect(getCuedVehicles()).toEqual(["e"]);
    });

    test("印の車を出すと、出ていき終えてから次のルールの一言と印を出すこと", () => {
      moveVehicles(stepMoves.slice(0, 1));
      const heldHeadline = screen.queryByText(firstHeadline);
      const heldCued = getCuedVehicles();
      advanceTime(exitStepHoldMs);

      const headline = screen.getByText(roadHeadline);
      const cued = getCuedVehicles();
      const rules = getRuleTexts();

      expect(heldHeadline).not.toBeNull();
      expect(heldCued).toEqual([]);
      expect(headline).toBeTruthy();
      expect(cued).toEqual(["g"]);
      expect(rules).toEqual([
        "前か後ろ",
        "道路",
        "伏せたルール",
        "伏せたルール",
      ]);
    });

    test("道路がない向きへ動かすと、出さずに縁の色で返し、もう片方へ出すと次の手順へ進むこと", () => {
      moveVehicles(stepMoves.slice(0, 1), exitStepHoldMs);
      moveVehicles([["g", "ArrowLeft"]]);
      const rejected = getCuedVehicles("rejected");
      const stillThere = queryVehicle("g");
      moveVehicles([["g", "ArrowRight"]], exitStepHoldMs);

      const headline = screen.getByText("植え込みがあると 通れません");

      expect(rejected).toEqual(["g"]);
      expect(stillThere).not.toBeNull();
      expect(headline).toBeTruthy();
      expect(getCuedVehicles()).toEqual(["b"]);
    });

    test("車に当てると、当たったのを見届けてから、塞いでいる車を示すこと", () => {
      moveVehicles(stepMoves.slice(0, 3), exitStepHoldMs);
      const headlineBefore = screen.getByText(carHeadline);
      moveVehicles(stepMoves.slice(3, 4));
      const rejected = getCuedVehicles("rejected");
      advanceTime(blockedStepHoldMs - 1);
      const stillHeld = screen.queryByText(carHeadline);
      advanceTime(1);

      const headline = screen.getByText("じゃまな車を先に出します");
      const cued = getCuedVehicles();

      expect(headlineBefore).toBeTruthy();
      expect(rejected).toEqual(["a"]);
      expect(stillHeld).not.toBeNull();
      expect(headline).toBeTruthy();
      expect(cued).toEqual(["c"]);
    });

    describe("手順を終えた場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves, blockedStepHoldMs);
      });

      test("残りを出すことを伝え、手が止まったときだけ今出せる車を示すこと", () => {
        const headline = screen.getByText(freePlayHeadline);
        const cuedBeforeIdle = getCuedVehicles();
        advanceTime(idleHintDelayMs);

        const cued = getCuedVehicles();
        const rules = getRuleTexts();

        expect(headline).toBeTruthy();
        expect(cuedBeforeIdle).toEqual([]);
        expect(cued).toHaveLength(1);
        expect(rules).toEqual(["前か後ろ", "道路", "植え込み", "車"]);
      });

      test("車がある向きへ動かすとわけを伝え、手が止まると印と一緒に残りを出す一言に戻すこと", () => {
        moveVehicles([["d", "ArrowRight"]]);
        const headline = screen.getByText(carHeadline);
        advanceTime(idleHintDelayMs);

        const restored = screen.getByText(freePlayHeadline);

        expect(headline).toBeTruthy();
        expect(restored).toBeTruthy();
        expect(getCuedVehicles()).toHaveLength(1);
      });

      test("すべて出すと、レベル1とのつながりを伝え、レベル1を遊ぶでレベル1を始めること", () => {
        moveVehicles(remainingMoves);
        advanceTime(0);
        const detail = screen.getByText(
          "レベル1は車が増えますが ルールは同じです",
        );
        fireEvent.click(screen.getByRole("button", { name: "レベル1を遊ぶ" }));

        expect(detail).toBeTruthy();
        expect(onStartPlay).toHaveBeenCalledOnce();
      });

      test("すべて出した後のもう一度で、始まりの盤面を見せてから最初の手順を始めること", () => {
        moveVehicles(remainingMoves);
        advanceTime(0);
        fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
        const caption = screen.getByText("最初は車が詰まっています");
        goThroughIntroSync();

        const cued = getCuedVehicles();
        const rules = getRuleTexts();

        expect(caption).toBeTruthy();
        expect(queryVehicle("a")).not.toBeNull();
        expect(cued).toEqual(["e"]);
        expect(rules).toEqual([
          "前か後ろ",
          "伏せたルール",
          "伏せたルール",
          "伏せたルール",
        ]);
      });
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      render(<ParkingJamTutorial open={true} onClose={onClose} />);
    });

    test("最初の画面で、何をするパズルかと空の駐車場を、ゴールの一言と一緒に見せること", () => {
      const purpose = screen.getByText(
        "駐車場の車を すべて道路へ出すパズルです",
      );
      const caption = screen.getByText("車がすべて出たらゴールです");

      expect(purpose).toBeTruthy();
      expect(caption).toBeTruthy();
      expect(queryVehicle("e")).toBeNull();
    });

    test("ゴールで次へを押すと、始まりの一言を添えて車の停まった始めの盤面を見せること", () => {
      pressNext();

      const caption = screen.getByText("最初は車が詰まっています");

      expect(caption).toBeTruthy();
      expect(queryVehicle("e")).not.toBeNull();
    });

    test("印の車を出すと、待たずに次のルールの一言と印を出し、当たると縁の色で返すこと", () => {
      pressNext();
      goThroughIntroSync();
      moveVehicles([
        ["e", "ArrowDown"],
        ["g", "ArrowLeft"],
      ]);

      const headline = screen.getByText(roadHeadline);
      const rejected = getCuedVehicles("rejected");

      expect(headline).toBeTruthy();
      expect(rejected).toEqual(["g"]);
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<ParkingJamTutorial open={true} onClose={onClose} />);
      skipIntro();
    });

    test("すべて出すと、プレイに戻ることを伝え、プレイに戻る操作で閉じること", () => {
      moveVehicles(stepMoves, blockedStepHoldMs);
      moveVehicles(remainingMoves);
      advanceTime(0);
      const detail = screen.getByText("プレイ中の駐車場も同じルールで解けます");
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(detail).toBeTruthy();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});

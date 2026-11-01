import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import {
  type TsumeShogiHand as TsumeShogiHandCounts,
  type TsumeShogiHandPieceType,
  tsumeShogiHandPieceTypes,
} from "@/games/tsume-shogi/puzzle/position";
import type { TsumeShogiRejection } from "@/games/tsume-shogi/session/session";
import {
  TsumeShogiHand,
  type TsumeShogiHandAvailability,
} from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiHand";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";

const hand = {
  ...Object.fromEntries(tsumeShogiHandPieceTypes.map((type) => [type, 0])),
  gold: 1,
  silver: 2,
} as TsumeShogiHandCounts;
const rejection: TsumeShogiRejection = {
  reason: "illegal",
  to: { file: 5, rank: 5 },
};

let animate: ReturnType<typeof vi.fn>;
let onSelectHandPiece: (pieceType: TsumeShogiHandPieceType) => void;

function renderHand(
  availability: TsumeShogiHandAvailability,
  currentRejection: TsumeShogiRejection | null,
) {
  return (
    <TsumeShogiHand
      hand={hand}
      selectedPieceType="gold"
      availability={availability}
      rejection={currentRejection}
      onSelectHandPiece={onSelectHandPiece}
    />
  );
}

function getHandPiece(name: string): HTMLElement {
  return within(screen.getByRole("group", { name: "攻方の持駒" })).getByRole(
    "button",
    { name },
  );
}

beforeEach(() => {
  animate = vi.fn();
  onSelectHandPiece = vi.fn<(pieceType: TsumeShogiHandPieceType) => void>();
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: animate,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, "animate");
});

describe("TsumeShogiHand", () => {
  describe("押せる場合", () => {
    beforeEach(() => {
      render(renderHand("available", null));
    });

    test("押した持駒を選ぶこと", () => {
      fireEvent.click(getHandPiece("銀 2枚"));

      expect(onSelectHandPiece).toHaveBeenCalledWith("silver");
    });
  });

  const unavailableCases = [
    ["玉方の応手を待つ間", "waiting"],
    ["この筋が尽きた後", "unavailable"],
  ] as const;

  describe.each(unavailableCases)("%sの場合", (_, availability) => {
    beforeEach(() => {
      render(renderHand(availability, null));
    });

    test("持駒を押せなくし、押しても選ばないこと", () => {
      const silver = getHandPiece("銀 2枚");
      fireEvent.pointerUp(silver, { pointerType: "touch", isPrimary: true });
      fireEvent.click(silver);

      expect(silver.getAttribute("aria-disabled")).toBe("true");
      expect(onSelectHandPiece).not.toHaveBeenCalled();
    });
  });

  describe("着手させなかった入力を受けた場合", () => {
    beforeEach(() => {
      const { rerender } = render(renderHand("available", null));
      rerender(renderHand("available", rejection));
    });

    test("選んでいる持駒を揺らすこと", () => {
      const shaken = animate.mock.contexts[0] as Element | undefined;

      expect(animate).toHaveBeenCalledOnce();
      expect(getHandPiece("金 1枚").contains(shaken ?? null)).toBe(true);
    });
  });

  describe("動きを減らす設定で着手させなかった入力を受けた場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
      const { rerender } = render(renderHand("available", null));
      rerender(renderHand("available", rejection));
    });

    test("揺らさずに、選んでいる持駒の地を短く変えること", () => {
      const flashed = getHandPiece("金 1枚").className.includes(
        tsumeShogiToneClassNames.handRejected,
      );

      expect(animate).not.toHaveBeenCalled();
      expect(flashed).toBe(true);
    });

    test("短い間の後に選んでいる持駒の地へ戻すこと", () => {
      act(() => {
        vi.runAllTimers();
      });

      const flashed = getHandPiece("金 1枚").className.includes(
        tsumeShogiToneClassNames.handRejected,
      );

      expect(flashed).toBe(false);
    });
  });

  describe("駒台の行に操作を置いた場合", () => {
    beforeEach(() => {
      render(
        <TsumeShogiHand
          hand={hand}
          selectedPieceType={null}
          availability="available"
          rejection={null}
          leadingAction={<button type="button">待った</button>}
          onSelectHandPiece={onSelectHandPiece}
        />,
      );
    });

    test("操作を持駒の並びの外に置くこと", () => {
      const pieces = screen.getByRole("group", { name: "攻方の持駒" });
      const action = screen.getByRole("button", { name: "待った" });

      expect(pieces.contains(action)).toBe(false);
    });
  });
});

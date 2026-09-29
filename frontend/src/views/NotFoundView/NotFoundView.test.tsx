import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { NotFoundView } from "@/views/NotFoundView";
import {
  _private,
  createNotFoundJigsawLayout,
} from "@/views/NotFoundView/jigsawLayout";

const {
  arrangeBoard,
  createBoardSeams,
  listPiecesInBoardOrder,
  sideDirection,
} = _private;

// generouted の Link はテスト環境で別の react-router 実体を参照するため、同じ実体の Link に差し替える。
vi.mock("@/router", async () => ({
  Link: (await import("react-router")).Link,
}));

type ScreenPoint = {
  x: number;
  y: number;
};

// jsdom はレイアウトを計算しないため、盤面の領域の寸法を固定して座標を決める。
const area = { width: 390, height: 796 };
// 画面はマウント時に Math.random からシードを作るため、同じシードになる値を返させて盤面を固定する。
const jigsawSeed = 1;
const layout = createNotFoundJigsawLayout(area, jigsawSeed);
const [upperPiece] = layout.zeroPieces;
const upperPieceTargetOffset = {
  x: upperPiece.slot.x - upperPiece.start.x,
  y: upperPiece.slot.y - upperPiece.start.y,
};
const dragOrigin = { x: 100, y: 500 };
const upperPieceLabel = "1つ目の0のピースをドラッグして戻す";
const upperPiecePlacedLabel = "1つ目の0のピースがはまりました";

function renderNotFoundView() {
  return render(
    <MemoryRouter initialEntries={["/missing"]}>
      <NotFoundView />
    </MemoryRouter>,
  );
}

function dragPiece(piece: HTMLElement, to: ScreenPoint) {
  const pointer = { button: 0, pointerId: 1 };
  fireEvent.pointerDown(piece, {
    ...pointer,
    clientX: dragOrigin.x,
    clientY: dragOrigin.y,
  });
  fireEvent.pointerMove(piece, { ...pointer, clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(piece, { ...pointer, clientX: to.x, clientY: to.y });
}

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(jigsawSeed / 0x1_0000_0000);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
    area.width,
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
    area.height,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("NotFoundView", () => {
  test("ギミックを操作しなくても見出しとパズル一覧へ戻るリンクを表示すること", () => {
    renderNotFoundView();

    expect(
      screen.getByRole("heading", { name: "ページが見つかりません" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "パズル一覧へ戻る" })
        .getAttribute("href"),
    ).toBe("/");
  });

  describe("ポインタ以外で起動した場合", () => {
    const ordinals = ["1つ目", "2つ目"] as const;
    let pieces: Record<(typeof ordinals)[number], HTMLElement>;

    beforeEach(() => {
      renderNotFoundView();
      pieces = {
        "1つ目": screen.getByRole("button", {
          name: "1つ目の0のピースをドラッグして戻す",
        }),
        "2つ目": screen.getByRole("button", {
          name: "2つ目の0のピースをドラッグして戻す",
        }),
      };
    });

    test.each(ordinals)("%sのピースを穴へはめること", (ordinal) => {
      fireEvent.click(pieces[ordinal], { detail: 0 });

      expect(pieces[ordinal].getAttribute("aria-label")).toBe(
        `${ordinal}の0のピースがはまりました`,
      );
      expect(pieces[ordinal].getAttribute("aria-disabled")).toBe("true");
    });
  });

  describe("ドラッグした場合", () => {
    let piece: HTMLElement;

    beforeEach(() => {
      renderNotFoundView();
      piece = screen.getByRole("button", { name: upperPieceLabel });
    });

    test("穴の位置で離したピースがはまること", () => {
      dragPiece(piece, {
        x: dragOrigin.x + upperPieceTargetOffset.x,
        y: dragOrigin.y + upperPieceTargetOffset.y,
      });

      expect(piece.getAttribute("aria-label")).toBe(upperPiecePlacedLabel);
    });

    test("穴から離れた位置で離したピースは元の位置へ戻ること", () => {
      dragPiece(piece, {
        x: dragOrigin.x + upperPieceTargetOffset.x + layout.pieceSize * 2,
        y: dragOrigin.y + upperPieceTargetOffset.y,
      });

      expect(piece.getAttribute("aria-label")).toBe(upperPieceLabel);
      expect(piece.style.transform).toBe("translate(0px, 0px) rotate(-4deg)");
    });
  });

  describe("ドラッグ中に別のポインタを離した場合", () => {
    let piece: HTMLElement;

    beforeEach(() => {
      renderNotFoundView();
      piece = screen.getByRole("button", { name: upperPieceLabel });
      fireEvent.pointerDown(piece, {
        button: 0,
        clientX: dragOrigin.x,
        clientY: dragOrigin.y,
        pointerId: 1,
      });
    });

    test("ドラッグ中のピースを配置しないこと", () => {
      fireEvent.pointerUp(piece, {
        button: 0,
        clientX: dragOrigin.x + upperPieceTargetOffset.x,
        clientY: dragOrigin.y + upperPieceTargetOffset.y,
        pointerId: 2,
      });

      expect(piece.getAttribute("aria-label")).toBe(upperPieceLabel);
    });
  });
});

describe("createNotFoundJigsawLayout", () => {
  const seed = 42;
  const otherSeed = 43;

  test("同じ領域とシードからは同じ盤面を作ること", () => {
    const first = createNotFoundJigsawLayout(area, seed);
    const second = createNotFoundJigsawLayout(area, seed);

    expect(second).toEqual(first);
  });

  test("シードが変わると凸凹の模様が変わること", () => {
    const first = createNotFoundJigsawLayout(area, seed);
    const second = createNotFoundJigsawLayout(area, otherSeed);

    expect(second.boardOutlinePath).not.toBe(first.boardOutlinePath);
  });

  test("シードが変わってもピースと穴の配置は変わらないこと", () => {
    const first = createNotFoundJigsawLayout(area, seed);
    const second = createNotFoundJigsawLayout(area, otherSeed);

    expect(
      second.zeroPieces.map(({ slot, start }) => ({ slot, start })),
    ).toEqual(first.zeroPieces.map(({ slot, start }) => ({ slot, start })));
  });
});

describe("createBoardSeams", () => {
  const seeds = Array.from({ length: 40 }, (_, index) => index * 0x9e3779b1);
  const areas = [
    { width: 320, height: 520 },
    { width: 390, height: 796 },
    { width: 844, height: 342 },
    { width: 1280, height: 852 },
  ] as const;
  const cases = areas.map((caseArea) => {
    const { grid } = arrangeBoard(caseArea);
    return {
      grid,
      label: `${caseArea.width}x${caseArea.height}`,
      pieces: listPiecesInBoardOrder(grid),
    };
  });

  test.each(cases)(
    "3辺以上の凸凹を持つピースの辺がすべて同じ向きにならないこと: $label",
    ({ grid, pieces }) => {
      const oneWayPieces = seeds.flatMap((seed) => {
        const seams = createBoardSeams(grid, seed);
        return pieces
          .filter(
            (piece) =>
              piece.sides.length >= 3 &&
              new Set(piece.sides.map((side) => sideDirection(seams, side)))
                .size === 1,
          )
          .map((piece) => ({ seed, cell: piece.lastCell }));
      });

      expect(oneWayPieces).toEqual([]);
    },
  );
});

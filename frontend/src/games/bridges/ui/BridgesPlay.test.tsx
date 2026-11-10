import {
  cleanup,
  fireEvent,
  render as renderWithoutRouter,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { MemoryRouter } from "react-router";

import { BRIDGES_DISPLAY_NAME } from "@/games/bridges/display-name";
import { createBridgesResult } from "@/games/bridges/play/use-bridges-play";
import { parseBridgesBoard } from "@/games/bridges/puzzle/board";
import type { BridgesSessionResult } from "@/games/bridges/session/session";
import { BridgesPlay } from "@/games/bridges/ui/BridgesPlay";
import { BOARD_MARGIN } from "@/games/bridges/ui/board/board-geometry";

/** 結果画面はブランドの帯からホームへ戻るリンクを持つので、ルーターの中で描く。 */
function render(ui: ReactElement) {
  return renderWithoutRouter(ui, { wrapper: MemoryRouter });
}

afterEach(() => {
  cleanup();
});

// 基準時間は 8 + 24×1 + 26×0.8 + 3×3 + 3×6 + 26×1 = 105.8秒、0点になる時間は 317.4秒。
const workload = {
  islandCount: 24,
  edgeCount: 32,
  bridgeCount: 26,
  countRoundCount: 3,
  connectivityRoundCount: 3,
  countReasoningUndecidedEdgeCount: 26,
};

// 23秒超過で速さ89点。待った・盤面を戻す・阻まれた回数は点に入らない。
const performance: BridgesSessionResult = {
  elapsedMs: 128_800,
  undoCount: 2,
  restartCount: 1,
  inputCount: 40,
  blockedCount: 3,
};
const result = createBridgesResult(performance, workload);

describe("BridgesPlay", () => {
  // 島: 0 (0,0)、1 (0,2)、2 (2,0)、3 (2,4)、4 (4,2)。
  // 辺: 0 = 島0-島1（横）、1 = 島0-島2（縦）、2 = 島1-島4（縦）、3 = 島2-島3（横）。辺2と辺3が交わる。
  const board = parseBridgesBoard([
    "1.1..",
    ".....",
    "1...1",
    ".....",
    "..1..",
  ]);
  const boardName = `${BRIDGES_DISPLAY_NAME}盤面 5行5列`;
  const callbacks = {
    onCycleEdge: vi.fn(),
    onUndo: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onClearAnimationComplete: vi.fn(),
    onStartNewProblem: vi.fn(),
    onOpenGameHome: vi.fn(),
    onBackToHome: vi.fn(),
  };
  const baseProps: ComponentProps<typeof BridgesPlay> = {
    difficulty: "5",
    progress: "result",
    elapsedMs: performance.elapsedMs,
    result,
    recordFeedback: { kind: "none" } as const,
    board,
    bridges: [0, 0, 0, 0],
    islandStatuses: ["short", "short", "short", "short", "short"],
    undoCount: performance.undoCount,
    edgeNotice: null,
    canUndo: false,
    canRestart: false,
    ...callbacks,
  };

  function renderPlay(props: Partial<ComponentProps<typeof BridgesPlay>> = {}) {
    return render(<BridgesPlay {...baseProps} {...props} />);
  }

  function getBoardGroup(): HTMLElement {
    return screen.getByRole("group", { name: boardName });
  }

  /** 盤面の絵を、周りの海の余白も含めて1マス 100px で置く。 */
  function placeBoard(): void {
    const size = (board.width + 2 * BOARD_MARGIN) * 100;
    vi.spyOn(getBoardGroup(), "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, size, size),
    );
  }

  /** 島0 と島1 の間（辺0）の線の上を押す。 */
  function tapBetweenFirstIslands(): void {
    fireEvent.pointerDown(getBoardGroup(), {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: (1.5 + BOARD_MARGIN) * 100,
      clientY: (0.5 + BOARD_MARGIN) * 100,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("完成演出中の場合", () => {
    beforeEach(() => {
      renderPlay({ progress: "clearing" });
      placeBoard();
    });

    test("盤面を見せ、結果画面をまだ出さないこと", () => {
      const boardGroup = screen.getByRole("group", { name: boardName });
      const resultScreen = screen.queryByRole("region", { name: "プレイ結果" });

      expect(boardGroup).toBeTruthy();
      expect(resultScreen).toBeNull();
    });

    test("盤面を押しても橋を回す操作を通知しないこと", () => {
      tapBetweenFirstIslands();

      expect(callbacks.onCycleEdge).not.toHaveBeenCalled();
    });
  });

  describe("プレイ中の場合", () => {
    beforeEach(() => {
      renderPlay({ progress: "playing", result: null });
      placeBoard();
    });

    test("島と島の間を押すと、その辺の橋を回す操作を通知すること", () => {
      tapBetweenFirstIslands();

      expect(callbacks.onCycleEdge).toHaveBeenCalledWith(0);
    });

    test("見出しに時間と待ったの回数を表示すること", () => {
      const header = screen.getByRole("heading", {
        name: BRIDGES_DISPLAY_NAME,
      }).parentElement!;
      const metrics = within(header)
        .getAllByText(/^(時間|待った)$/)
        .map(
          (label) => `${label.textContent} ${label.nextSibling?.textContent}`,
        );

      expect(metrics).toEqual(["時間 02:08", "待った 2"]);
    });
  });

  describe("完成演出を終えた場合", () => {
    beforeEach(() => {
      renderPlay();
    });

    test("共通の結果階層でゲーム名・難易度・スコアを表示すること", () => {
      const score = within(screen.getByRole("region", { name: "スコア" }));

      expect(screen.getByText(BRIDGES_DISPLAY_NAME)).toBeTruthy();
      expect(screen.getByText("レベル 5")).toBeTruthy();
      expect(score.getByText("89点（100点満点）")).toBeTruthy();
    });

    test("時間と基準時間との差・橋の操作と解に要る橋の本数との差を主な成績として表示すること", () => {
      const terms = screen.getAllByRole("term").map((term) => term.textContent);
      const definitions = screen
        .getAllByRole("definition")
        .map((definition) => definition.textContent);

      expect(terms).toEqual(["時間", "橋の操作"]);
      expect(definitions).toEqual([
        "02:08",
        "基準差 +00:23",
        "40回",
        "最短差 +14",
      ]);
    });

    test("盤面を表示しないこと", () => {
      const boardGroup = screen.queryByRole("group", { name: boardName });

      expect(boardGroup).toBeNull();
    });

    const actionCases = [
      ["次の問題", "onStartNewProblem"],
      ["もう一度", "onReplay"],
      ["問題選択", "onOpenGameHome"],
    ] as const;

    test.each(actionCases)(
      "%s ボタンで対応する操作を通知すること",
      (buttonName, callbackName) => {
        fireEvent.click(screen.getByRole("button", { name: buttonName }));

        expect(callbacks[callbackName]).toHaveBeenCalledOnce();
      },
    );

    describe("スコアの内訳を開いた場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole("button", { name: "採点内訳" }));
      });

      test("速さの点と、待った・盤面を戻す・交わる橋に阻まれた回数・基準時間を内訳に表示すること", () => {
        const items = screen
          .getAllByRole("term")
          .map(
            (term) => `${term.textContent} ${term.nextSibling?.textContent}`,
          );

        expect(items).toEqual(
          expect.arrayContaining([
            "速さ 89 / 100",
            "待った 2回",
            "盤面を戻す 1回",
            "交わる橋に阻まれた 3回",
          ]),
        );
      });

      test("速さの基準を、0点になる時間と、基準時間が何から決まるか・減点しない回数で表示すること", () => {
        const criteria = screen.getByText(/^基準時間\d\d:\d\d(\.\d)?以内/);

        expect(criteria.textContent).toBe(
          "基準時間01:45.8以内で100点、05:17.4以上で0点、その間は時間に応じて減らす。基準時間は、この問題の島と橋の数と、考える所（数字だけでは決まらない所）の多さで決まる。「待った」・「盤面を戻す」・架け直し・交わる橋に阻まれた回数では減点しない。",
        );
      });
    });
  });

  describe("盤面の変化の読み上げ", () => {
    const cases = [
      [
        "橋を1本架けた",
        { id: 1, change: "changed", edge: 0, count: 1 },
        "1行1列と1行3列の間 橋1本",
      ],
      [
        "橋を2本にした",
        { id: 2, change: "changed", edge: 0, count: 2 },
        "1行1列と1行3列の間 橋2本",
      ],
      [
        "橋を外した",
        { id: 3, change: "changed", edge: 0, count: 0 },
        "1行1列と1行3列の間 橋なし",
      ],
      [
        "交わる橋に阻まれた",
        { id: 4, change: "blocked", edge: 2, crossingEdges: [3] },
        "1行3列と5行3列の間 交わる橋があって架けられない",
      ],
      ["待ったで戻した", { id: 5, change: "undone" }, "待った"],
    ] as const;

    test.each(cases)(
      "%sとき、状態の変化を読み上げの領域に出すこと",
      (_, edgeNotice, expected) => {
        renderPlay({ progress: "playing", result: null, edgeNotice });

        expect(screen.getByRole("status").textContent).toBe(expected);
      },
    );

    describe("全部の島がつながって完成した場合", () => {
      beforeEach(() => {
        renderPlay({ progress: "clearing" });
      });

      test("完成を読み上げの領域に出すこと", () => {
        expect(screen.getByRole("status").textContent).toBe("完成");
      });
    });
  });

  describe("検証情報のつなぎ先を渡した場合", () => {
    const onOpenDiagnostics = vi.fn();

    beforeEach(() => {
      renderPlay({ onOpenDiagnostics });
    });

    test("検証情報ボタンで検証情報を開く操作を通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "検証情報" }));

      expect(onOpenDiagnostics).toHaveBeenCalledOnce();
    });
  });
});

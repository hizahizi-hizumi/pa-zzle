import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import {
  listSolitairePoolEntries,
  restoreSolitairePoolEntry,
} from "@/games/solitaire/problem/problem-pool";
import { createSolitaireInitialState } from "@/games/solitaire/puzzle/state";
import { SolitairePlay } from "@/games/solitaire/ui/SolitairePlay";

afterEach(cleanup);

const { problem } = restoreSolitairePoolEntry(
  listSolitairePoolEntries("1")[0]!,
);

function openPlayMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

function createProps(): ComponentProps<typeof SolitairePlay> {
  return {
    difficulty: "1",
    progress: "playing",
    elapsedMs: 65_000,
    result: null,
    recordFeedback: { kind: "none" } as const,
    state: createSolitaireInitialState(problem.columns, problem.stock),
    undoCount: 2,
    selectedSource: null,
    operation: null,
    isStuck: false,
    onPressPile: vi.fn(),
    canUndo: true,
    onUndo: vi.fn(),
    canRestart: true,
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onClearAnimationComplete: vi.fn(),
    onOpenGameHome: vi.fn(),
    onBackToAppHome: vi.fn(),
    onOpenHowToPlay: vi.fn(),
    onOpenTutorial: vi.fn(),
    onOpenDiagnostics: vi.fn(),
    renderSettingsDialog: () => null,
  };
}

describe("SolitairePlay", () => {
  describe("プレイ中の場合", () => {
    let props: ComponentProps<typeof SolitairePlay>;

    beforeEach(() => {
      props = createProps();
      render(<SolitairePlay {...props} />);
    });

    test("見出しに経過時間と待ったの回数を出すこと", () => {
      expect(screen.getByText("01:05")).toBeTruthy();
      expect(screen.getByText("待った")).toBeTruthy();
    });

    test("知らせを出さないこと", () => {
      expect(screen.queryByRole("status")).toBeNull();
    });

    test("盤面の山を押すと、その山を知らせること", () => {
      fireEvent.click(screen.getByRole("button", { name: /^列1、/ }));

      expect(props.onPressPile).toHaveBeenCalledWith({
        pile: "column",
        columnIndex: 0,
      });
    });

    test("盤面下の待ったで直前の手を戻せること", () => {
      fireEvent.click(screen.getByRole("button", { name: "待った" }));

      expect(props.onUndo).toHaveBeenCalledOnce();
    });

    test("メニューから盤面を戻せること", () => {
      openPlayMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "盤面を戻す" }));

      expect(props.onRestart).toHaveBeenCalledOnce();
    });
  });

  describe("どの手順でも組札を増やせない場合", () => {
    beforeEach(() => {
      render(<SolitairePlay {...createProps()} isStuck />);
    });

    test("盤面の下に知らせを1行で出し、待ったを残すこと", () => {
      expect(screen.getByRole("status").textContent).toBe("組札へ運べない");
      expect(screen.getByRole("button", { name: "待った" })).toBeTruthy();
    });
  });
});

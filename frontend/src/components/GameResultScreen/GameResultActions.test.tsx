import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { GameResultActions } from "@/components/GameResultScreen/GameResultActions";
import { ResultEmblemContext } from "@/components/GameResultScreen/result-emblem";

function renderActions(emblem: ReactNode) {
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <ResultEmblemContext value={emblem}>
          <GameResultActions
            onStartNewProblem={() => {}}
            onOpenGameHome={() => {}}
          />
        </ResultEmblemContext>
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
}

afterEach(() => {
  cleanup();
});

describe("GameResultActions", () => {
  describe("解いた問題の姿が渡されている場合", () => {
    beforeEach(() => {
      renderActions(<span aria-hidden="true">解いた問題の姿</span>);
    });

    test("「問題選択」に、名前を変えずに姿を添えること", () => {
      const collection = screen.getByRole("button", { name: "問題選択" });

      expect(within(collection).getByText("解いた問題の姿")).toBeTruthy();
    });
  });

  describe("解いた問題の姿が渡されていない場合", () => {
    beforeEach(() => {
      renderActions(null);
    });

    test("姿を添えないこと", () => {
      const emblem = document.querySelector("[data-result-emblem]");

      expect(emblem).toBeNull();
    });
  });
});

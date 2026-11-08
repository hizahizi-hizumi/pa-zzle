import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, test } from "vitest";
import { useRecordResultNavigation } from "@/game-catalog/record-result-navigation";
import type { PlayRecord } from "@/records/play-record";

const record = { id: "record-1", gameId: "nanpure" } as PlayRecord;
const outcome = { status: "recorded" } as const;

function PlayHarness() {
  useRecordResultNavigation(true, record, outcome);
  return <p>結果準備中</p>;
}

afterEach(cleanup);

describe("useRecordResultNavigation", () => {
  test("試遊した結果への遷移で次問識別子を保持すること", async () => {
    const router = createMemoryRouter(
      [
        { path: "/puzzles/nanpure/play/:difficulty", element: <PlayHarness /> },
        { path: "/puzzles/:game/result/:recordId", element: <p>結果画面</p> },
      ],
      {
        initialEntries: [
          "/puzzles/nanpure/play/3?problem=4d921err5v&study=nanpure.c.0.p",
        ],
      },
    );
    render(<RouterProvider router={router} />);
    await screen.findByText("結果画面");

    expect(router.state.location.pathname).toBe(
      "/puzzles/nanpure/result/record-1",
    );
    expect(router.state.location.state).toMatchObject({
      studyCode: "nanpure.c.0.p",
    });
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, test } from "vitest";
import { ContinuousStudyView } from "@/views/ContinuousStudyView";

afterEach(cleanup);
const routes = [
  { path: "/studies/continuous", element: <ContinuousStudyView /> },
];

describe("ContinuousStudyView", () => {
  test("試遊者には操作を増やさず、10問の連続プレイを提示する", () => {
    const router = createMemoryRouter(routes, {
      initialEntries: [
        "/studies/continuous?game=nanpure&difficulty=3&method=diverse&episode=1&participant=1",
      ],
    });
    render(<RouterProvider router={router} />);
    expect(
      screen.getByRole("heading", { name: "連続プレイの比較" }),
    ).toBeTruthy();
    expect(screen.queryByRole("region", { name: "比較条件" })).toBeNull();
    const link = screen.getByRole("link", { name: "1問目から始める" });
    expect(link.getAttribute("href")).toMatch(
      /^\/puzzles\/nanpure\/play\/3\?problem=.+&study=continuous.nanpure.3.diverse.1.0\.p$/,
    );
  });

  test("研究者が同じゲーム・難易度で比較方法を切り替えられる", () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ["/studies/continuous"],
    });
    render(<RouterProvider router={router} />);
    fireEvent.click(screen.getByRole("button", { name: "パーキングジャム" }));
    fireEvent.click(screen.getByRole("button", { name: "Lv4" }));
    fireEvent.click(screen.getByRole("button", { name: "変化を調整" }));
    const link = screen.getByRole("link", { name: "1問目から始める" });
    expect(link.getAttribute("href")).toMatch(
      /^\/puzzles\/parking-jam\/play\/4\?problem=.+&study=continuous.parking-jam.4.diverse.0.0$/,
    );
    expect(router.state.location.search).toContain("difficulty=4");
  });
});

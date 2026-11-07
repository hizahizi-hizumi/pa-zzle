import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { CuratedStudyView } from "@/views/CuratedStudyView";

afterEach(cleanup);

describe("CuratedStudyView", () => {
  const routes = [{ path: "/studies/curated", element: <CuratedStudyView /> }];

  test("初期状態ではナンプレの固定問題6問を一覧から選べること", () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ["/studies/curated"],
    });
    render(<RouterProvider router={router} />);
    const list = within(screen.getByRole("region", { name: "固定問題の提示" }));
    const links = list.getAllByRole("link", { name: /候補/ });

    expect(links).toHaveLength(6);
    expect(links[0]?.getAttribute("href")).toBe(
      "/puzzles/nanpure/play/3?problem=4j11bcavdg",
    );
    expect(links[0]?.getAttribute("target")).toBe("_blank");
  });

  test("ゲームを切り替えると固定候補も対応するゲームへ切り替わること", () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ["/studies/curated"],
    });
    render(<RouterProvider router={router} />);
    fireEvent.click(screen.getByRole("button", { name: "パーキングジャム" }));
    const links = within(
      screen.getByRole("region", { name: "固定問題の提示" }),
    ).getAllByRole("link", { name: /候補/ });

    expect(links[0]?.getAttribute("href")).toBe(
      "/puzzles/parking-jam/play/3?problem=57vqfvov05",
    );
    expect(router.state.location.search).toContain("game=parking-jam");
  });

  test("順番表示は次へ進み末尾では進めなくなり現在位置がURLに残ること", () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ["/studies/curated?presentation=sequence&position=4"],
    });
    render(<RouterProvider router={router} />);
    fireEvent.click(screen.getByRole("button", { name: "次の問題" }));
    const playLink = screen.getByRole("link", { name: "この問題を遊ぶ" });

    expect(playLink.getAttribute("href")).toBe(
      "/puzzles/nanpure/play/5?problem=434eh6j81g",
    );
    expect(router.state.location.search).toContain("position=5");
    expect(
      (screen.getByRole("button", { name: "次の問題" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  test("存在しない進行位置は先頭へ戻し、ゲーム切替でも位置を初期化すること", () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ["/studies/curated?presentation=sequence&position=-20"],
    });
    render(<RouterProvider router={router} />);
    fireEvent.click(screen.getByRole("button", { name: "パーキングジャム" }));
    const playLink = screen.getByRole("link", { name: "この問題を遊ぶ" });

    expect(playLink.getAttribute("href")).toBe(
      "/puzzles/parking-jam/play/3?problem=57vqfvov05",
    );
    expect(router.state.location.search).toContain("position=0");
  });

  test("固定の比較セットを切り替えると別の問題になり、セット指定がURLに残ること", () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ["/studies/curated"],
    });
    render(<RouterProvider router={router} />);
    fireEvent.click(screen.getByRole("button", { name: "セットB" }));
    const region = within(
      screen.getByRole("region", { name: "固定問題の提示" }),
    );
    expect(
      region.getAllByRole("link", { name: /候補/ })[0]?.getAttribute("href"),
    ).toBe("/puzzles/nanpure/play/3?problem=n4cg2fuhrh");
    expect(router.state.location.search).toContain("set=b");
    fireEvent.click(screen.getByRole("button", { name: "順番に見る" }));
    expect(
      screen.getByRole("link", { name: "この問題を遊ぶ" }).getAttribute("href"),
    ).toBe("/puzzles/nanpure/play/3?problem=n4cg2fuhrh");
    expect(router.state.location.search).toContain("set=b");
  });

  test("問題セット切替は順番表示の進行位置を先頭に戻すこと", () => {
    const router = createMemoryRouter(routes, {
      initialEntries: [
        "/studies/curated?set=b&presentation=sequence&position=4",
      ],
    });
    render(<RouterProvider router={router} />);
    fireEvent.click(screen.getByRole("button", { name: "セットA" }));
    expect(screen.getByText(/1 \/ 6 問目/)).toBeTruthy();
    expect(router.state.location.search).toContain("position=0");
  });
  test("既存の出題方法は固定候補を使わず別タブから起動できること", () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ["/studies/curated?game=parking-jam"],
    });
    render(<RouterProvider router={router} />);
    const region = within(
      screen.getByRole("region", { name: "既存の出題方法" }),
    );
    const random = region.getByRole("link", { name: "ランダム Lv4" });
    const zukan = region.getByRole("link", { name: "図鑑で選ぶ" });

    expect(random.getAttribute("href")).toBe("/puzzles/parking-jam/play/4");
    expect(random.getAttribute("target")).toBe("_blank");
    expect(zukan.getAttribute("href")).toBe("/puzzles/parking-jam/zukan");
  });
});

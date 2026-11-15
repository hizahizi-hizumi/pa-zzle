import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import {
  createProblemIdSearch,
  useRequestedProblemId,
} from "@/app/navigation/problem-id-query";

function RouterWrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/puzzles/nanpure?problem=abc123"]}>
      {children}
    </MemoryRouter>
  );
}

function useProblemSelection() {
  const selected = useRequestedProblemId();
  const navigate = useNavigate();
  const location = useLocation();
  return { selected, location, navigate };
}

describe("ゲームホームの問題URL", () => {
  test("問題IDをURLから読み、消さずに維持する", () => {
    const { result } = renderHook(useProblemSelection, {
      wrapper: RouterWrapper,
    });
    expect(result.current.selected).toBe("abc123");
    expect(result.current.location.search).toBe("?problem=abc123");
  });

  test("ブラウザ履歴の移動で選択を復元する", () => {
    const { result } = renderHook(useProblemSelection, {
      wrapper: RouterWrapper,
    });
    act(() => result.current.navigate("/puzzles/nanpure?level=2"));
    expect(result.current.selected).toBeNull();
    act(() => result.current.navigate(-1));
    expect(result.current.selected).toBe("abc123");
  });

  test("問題IDをクエリへ正しくエンコードする", () => {
    expect(createProblemIdSearch("abc 123")).toBe("?problem=abc+123");
  });
});

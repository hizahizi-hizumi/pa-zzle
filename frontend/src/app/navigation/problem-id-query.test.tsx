import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import {
  createProblemIdSearch,
  useRequestedProblemId,
} from "@/app/navigation/problem-id-query";

type RouterWrapperProps = { children: ReactNode };

function RouterWrapper({ children }: RouterWrapperProps) {
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

function mountProblemSelection() {
  return renderHook(useProblemSelection, { wrapper: RouterWrapper });
}

describe("useRequestedProblemId", () => {
  let hook: ReturnType<typeof mountProblemSelection>;

  beforeEach(() => {
    hook = mountProblemSelection();
  });

  test("問題IDをURLから読み、消さずに維持すること", () => {
    const selected = hook.result.current.selected;
    const search = hook.result.current.location.search;

    expect(selected).toBe("abc123");
    expect(search).toBe("?problem=abc123");
  });

  test("ブラウザ履歴の移動で選択を復元すること", () => {
    act(() => hook.result.current.navigate("/puzzles/nanpure?level=2"));
    const changedSelection = hook.result.current.selected;
    act(() => hook.result.current.navigate(-1));
    const restoredSelection = hook.result.current.selected;

    expect(changedSelection).toBeNull();
    expect(restoredSelection).toBe("abc123");
  });
});

describe("createProblemIdSearch", () => {
  const problemId = "abc 123";

  test("問題IDをクエリへ正しくエンコードすること", () => {
    const search = createProblemIdSearch(problemId);

    expect(search).toBe("?problem=abc+123");
  });
});

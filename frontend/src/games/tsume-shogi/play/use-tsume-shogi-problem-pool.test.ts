import { renderHook, waitFor } from "@testing-library/react";

import { useTsumeShogiProblemPool } from "@/games/tsume-shogi/play/use-tsume-shogi-problem-pool";
import problemPoolJson from "@/games/tsume-shogi/problem/problem-pool.json";

describe("useTsumeShogiProblemPool", () => {
  let fetchProblemPool: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchProblemPool = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockImplementation(
        async () => new Response(JSON.stringify(problemPoolJson)),
      );
    vi.stubGlobal("fetch", fetchProblemPool);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("読み込めなければ失敗を返し、画面を開き直すと読み込み直して読み込み済みを返すこと", async () => {
    const first = renderHook(() => useTsumeShogiProblemPool());
    const initialStatus = first.result.current;
    await waitFor(() => expect(first.result.current).toBe("failed"));
    first.unmount();
    const reopened = renderHook(() => useTsumeShogiProblemPool());
    await waitFor(() => expect(reopened.result.current).toBe("loaded"));
    const reopenedAgain = renderHook(() => useTsumeShogiProblemPool());

    expect(initialStatus).toBe("loading");
    expect(fetchProblemPool).toHaveBeenCalledTimes(2);
    expect(reopenedAgain.result.current).toBe("loaded");
  });
});

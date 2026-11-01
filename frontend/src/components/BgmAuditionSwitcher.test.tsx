import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";

import { BgmAuditionSwitcher } from "@/components/BgmAuditionSwitcher";
import {
  type BgmAuditionCandidate,
  bgmAuditionCandidates,
  useBgmAuditionCandidate,
} from "@/components/BgmAuditionSwitcher/bgm-audition-candidates";

const storageKey = "pa-zzle.bgm-audition.v1";

afterEach(() => {
  window.localStorage.clear();
});

describe("BgmAuditionSwitcher", () => {
  let onSelect: (candidate: BgmAuditionCandidate) => void;

  beforeEach(() => {
    onSelect = vi.fn();
    render(
      <BgmAuditionSwitcher
        candidate={bgmAuditionCandidates[0]}
        onSelect={onSelect}
        band="regular"
      />,
    );
  });

  test("候補を番号と名前で並べること", () => {
    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(options).toEqual([
      "1 パズルポップ",
      "2 チップチューン",
      "5 シンセポップ",
      "6 オルゴールと弦",
      "7 トイポップ",
      "8 チップシンセポップ",
      "9 8bit マレット",
    ]);
  });

  test("選んだ候補を知らせること", () => {
    fireEvent.change(screen.getByLabelText("BGM の候補（試聴用）"), {
      target: { value: "7" },
    });

    expect(onSelect).toHaveBeenCalledWith(
      bgmAuditionCandidates.find(({ number }) => number === 7),
    );
  });
});

describe("useBgmAuditionCandidate", () => {
  describe("候補を保存していない端末の場合", () => {
    test("最初の候補を返すこと", () => {
      const { result } = renderHook(useBgmAuditionCandidate);

      expect(result.current[0].number).toBe(1);
    });
  });

  describe("候補を選んだ場合", () => {
    const selectedNumber = 8;

    beforeEach(() => {
      const { result, unmount } = renderHook(useBgmAuditionCandidate);
      const selected = bgmAuditionCandidates.find(
        ({ number }) => number === selectedNumber,
      );
      if (selected) {
        act(() => result.current[1](selected));
      }
      unmount();
    });

    test("次に開いたときも選んだ候補を返すこと", () => {
      const { result } = renderHook(useBgmAuditionCandidate);

      expect(result.current[0].number).toBe(selectedNumber);
      expect(window.localStorage.getItem(storageKey)).toBe(
        String(selectedNumber),
      );
    });
  });
});

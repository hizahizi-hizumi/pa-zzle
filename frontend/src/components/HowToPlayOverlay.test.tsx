import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { HowToPlayOverlay } from "@/components/HowToPlayOverlay";
import { useHowToPlayExampleSelection } from "@/components/how-to-play-example-selection";

afterEach(cleanup);

/** 押すと物を選び、選んでいる間はそのことを遊び方の層に知らせる例。 */
function SelectableExample() {
  const [selected, setSelected] = useState(false);
  useHowToPlayExampleSelection(selected, () => setSelected(false));
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => setSelected(true)}
    >
      島
    </button>
  );
}

function pressEscape(): void {
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: "Escape",
  });
}

describe("HowToPlayOverlay", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onClose = vi.fn<() => void>();
    render(
      <HowToPlayOverlay
        open
        game={{ name: "橋", pictogramSvg: "<svg></svg>" }}
        description="島を/橋で/つなぐ/パズルです。"
        goal={<span>ゴール</span>}
        rules={<SelectableExample />}
        operations={null}
        scoring={null}
        onClose={onClose}
      />,
    );
  });

  function getExample(): HTMLElement {
    return within(screen.getByRole("dialog")).getByRole("button", {
      name: "島",
    });
  }

  describe("例で物を選んでいる場合", () => {
    beforeEach(() => {
      fireEvent.click(getExample());
    });

    test("Esc で、層を閉じずに例の選びを解くこと", () => {
      pressEscape();

      const result = {
        pressed: getExample().getAttribute("aria-pressed"),
        closed: onClose.mock.calls.length,
      };

      expect(result).toEqual({ pressed: "false", closed: 0 });
    });

    test("選びを解いた後の Esc で、層を閉じること", () => {
      pressEscape();
      pressEscape();

      const closed = onClose.mock.calls.length;

      expect(closed).toBe(1);
    });
  });

  describe("例で物を選んでいない場合", () => {
    test("Esc で層を閉じること", () => {
      pressEscape();

      const closed = onClose.mock.calls.length;

      expect(closed).toBe(1);
    });
  });

  test("上に留めたタブの列に、送って見せる要素が隠れないよう、送る領域の上端に余白を取ること", () => {
    const scroller = within(screen.getByRole("dialog"))
      .getByRole("tablist")
      .closest(".overflow-y-auto");

    const padding = scroller?.className.split(" ");

    expect(padding).toContain("scroll-pt-11");
  });
});

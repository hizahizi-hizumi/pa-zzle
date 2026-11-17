import { cleanup, render } from "@testing-library/react";

import {
  HowToPlayMarkLegend,
  type HowToPlayShownMarks,
} from "@/components/HowToPlayMarkLegend";

afterEach(cleanup);

/** 見えている凡例の読み上げの言葉。隠した並びは `aria-hidden` で読み上げから外れる。 */
function readShownLegend(container: HTMLElement): string {
  const shown = container.querySelector(
    '[data-how-to-play-caption-layer][aria-hidden="false"]',
  );
  return shown?.textContent ?? "";
}

function readShownMarks(container: HTMLElement): (string | null)[] {
  return Array.from(
    container.querySelectorAll(
      '[data-how-to-play-caption-layer][aria-hidden="false"] [data-how-to-play-verdict-mark]',
    ),
    (mark) => mark.getAttribute("data-how-to-play-verdict-mark"),
  );
}

describe("HowToPlayMarkLegend", () => {
  const labels = { allowed: "通れる", disallowed: "通れない" };
  const cases: readonly {
    name: string;
    shownMarks: HowToPlayShownMarks;
    legend: string;
    marks: string[];
  }[] = [
    {
      name: "両方の印が出ている",
      shownMarks: { allowed: true, disallowed: true },
      legend: "通れる、通れない",
      marks: ["allowed", "disallowed"],
    },
    {
      name: "✓ の印だけが出ている",
      shownMarks: { allowed: true, disallowed: false },
      legend: "通れる",
      marks: ["allowed"],
    },
    {
      name: "✕ の印だけが出ている",
      shownMarks: { allowed: false, disallowed: true },
      legend: "通れない",
      marks: ["disallowed"],
    },
    {
      name: "印が出ていない",
      shownMarks: { allowed: false, disallowed: false },
      legend: "",
      marks: [],
    },
  ];

  describe.each(cases)("$name 場合", ({ shownMarks, legend, marks }) => {
    let container: HTMLElement;

    beforeEach(() => {
      ({ container } = render(
        <HowToPlayMarkLegend labels={labels} shownMarks={shownMarks} />,
      ));
    });

    test("出ている印の記号だけを ✓・✕ の順に説明し、2つの言葉を「、」で区切って読むこと", () => {
      const shown = {
        legend: readShownLegend(container),
        marks: readShownMarks(container),
      };

      expect(shown).toEqual({ legend, marks });
    });
  });
});

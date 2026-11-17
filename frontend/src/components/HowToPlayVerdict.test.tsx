import { cleanup, render } from "@testing-library/react";
import type { ComponentProps } from "react";

import { HowToPlayVerdict } from "@/components/HowToPlayVerdict";

afterEach(cleanup);

function getReason(container: HTMLElement): HTMLElement | null {
  return container.querySelector("[data-how-to-play-verdict-reason]");
}

describe("HowToPlayVerdict", () => {
  const labels = { allowed: "できる", disallowed: "できない" };
  const foreground = "text-foreground";
  const cases: readonly {
    name: string;
    props: Partial<ComponentProps<typeof HowToPlayVerdict>>;
    reason: { text: string; tone: string } | null;
  }[] = [
    {
      name: "✕ に別のルールのわけを添える",
      props: { verdict: "disallowed", reason: "3つ続く" },
      reason: { text: "・3つ続く", tone: foreground },
    },
    {
      name: "✓ に別のルールのわけを添える",
      props: { verdict: "allowed", reason: "多すぎの島" },
      reason: { text: "・多すぎの島", tone: foreground },
    },
    {
      name: "✕ にルールそのもののわけを添える",
      props: { verdict: "disallowed", ruleReason: "出た先の数字は2" },
      reason: { text: "・出た先の数字は2", tone: foreground },
    },
    {
      name: "途中にルールそのもののわけを添える",
      props: { verdict: "incomplete", ruleReason: "2マス残る" },
      reason: { text: "・2マス残る", tone: "text-muted-foreground" },
    },
    {
      name: "両方のわけを渡す",
      props: { verdict: "disallowed", reason: "穴", ruleReason: "1マス残る" },
      reason: { text: "・穴", tone: foreground },
    },
    {
      name: "わけを渡さない",
      props: { verdict: "disallowed" },
      reason: null,
    },
  ];

  describe.each(cases)("$name 場合", ({ props, reason }) => {
    let container: HTMLElement;

    beforeEach(() => {
      ({ container } = render(
        <HowToPlayVerdict verdict="allowed" labels={labels} {...props} />,
      ));
    });

    test("わけを、判定の状態に合う色で判定の下に1つだけ添えること", () => {
      const shown = getReason(container);
      const read =
        shown === null
          ? null
          : { text: shown.textContent, tones: shown.className.split(" ") };

      expect(read).toEqual(
        reason === null
          ? null
          : { text: reason.text, tones: expect.arrayContaining([reason.tone]) },
      );
    });
  });

  describe("✕ の判定の場合", () => {
    let container: HTMLElement;

    beforeEach(() => {
      ({ container } = render(
        <HowToPlayVerdict verdict="disallowed" labels={labels} />,
      ));
    });

    test("どのゲームでも ✕ の言葉を文字の色で描くこと", () => {
      const tone = container
        .querySelector('[data-how-to-play-caption-layer="disallowed"] > span')
        ?.className.split(" ");

      expect(tone).toContain("text-foreground");
    });
  });

  describe("わけを添える場合", () => {
    let container: HTMLElement;

    beforeEach(() => {
      ({ container } = render(
        <HowToPlayVerdict
          verdict="disallowed"
          labels={labels}
          reason="列・ブロックでも重なる"
        />,
      ));
    });

    test("わけの行の高さを取らずに、幅だけを例の幅に数えること", () => {
      const reason = getReason(container);

      const placed = [
        reason?.className.includes("h-0"),
        reason?.className.includes("absolute"),
      ];

      expect(placed).toEqual([true, false]);
    });
  });
});

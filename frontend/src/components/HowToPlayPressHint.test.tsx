import { cleanup, render } from "@testing-library/react";

import {
  HowToPlayPressHint,
  type HowToPlayPressHintCorner,
  type HowToPlayPressHintPointer,
} from "@/components/HowToPlayPressHint";

afterEach(cleanup);

function getHint(container: HTMLElement): HTMLElement {
  const hint = container.querySelector<HTMLElement>(
    "[data-how-to-play-press-hint]",
  );
  if (hint === null) {
    throw new Error("手がかりがありません");
  }
  return hint;
}

function getPointer(container: HTMLElement): SVGElement {
  const pointer = container.querySelector<SVGElement>(
    "[data-how-to-play-press-hint-pointer]",
  );
  if (pointer === null) {
    throw new Error("指のアイコンがありません");
  }
  return pointer;
}

describe("HowToPlayPressHint", () => {
  describe("何も渡さない場合", () => {
    let container: HTMLElement;

    beforeEach(() => {
      ({ container } = render(<HowToPlayPressHint />));
    });

    test("押しを下の物へ通し、読み上げないこと", () => {
      const hint = getHint(container);

      const passes = [
        hint.getAttribute("aria-hidden"),
        hint.className.includes("pointer-events-none"),
      ];

      expect(passes).toEqual(["true", true]);
    });

    test("指のアイコンの大きさを、単位に比べて決めて 14px から 20px に収めること", () => {
      const size = getHint(container)
        .querySelector<HTMLElement>("[style]")
        ?.style.getPropertyValue("--how-to-play-hint-pointer");

      expect(size).toBe(
        "clamp(14px, calc(var(--how-to-play-hint-unit) * 0.3), 20px)",
      );
    });

    test("単位を祖先から受け取り、受け取らなければ押す物の短い辺にすること", () => {
      const unit = getHint(container)
        .querySelector<HTMLElement>("[style]")
        ?.style.getPropertyValue("--how-to-play-hint-unit");

      expect(unit).toBe("var(--how-to-play-unit, 100cqmin)");
    });
  });

  describe("指の置き場所", () => {
    const cases: readonly {
      pointer: HowToPlayPressHintPointer;
      placement: Partial<Record<"left" | "right" | "top" | "bottom", string>>;
    }[] = [
      { pointer: "center", placement: { left: "50%", top: "50%" } },
      {
        pointer: "fingertip-on-center",
        placement: { left: "50%", top: "50%" },
      },
      {
        pointer: "inside-corner",
        placement: {
          right: "calc(var(--how-to-play-hint-unit) * 0.06)",
          bottom: "calc(var(--how-to-play-hint-unit) * 0.06)",
        },
      },
      {
        pointer: "outside-corner",
        placement: {
          right: "calc(var(--how-to-play-hint-pointer) * -0.5)",
          bottom: "calc(var(--how-to-play-hint-pointer) * -0.5)",
        },
      },
      {
        pointer: "bottom-edge",
        placement: {
          left: "50%",
          bottom: "calc(var(--how-to-play-hint-pointer) * -0.5)",
        },
      },
    ];

    describe.each(cases)("$pointer の場合", ({ pointer, placement }) => {
      let container: HTMLElement;

      beforeEach(() => {
        ({ container } = render(<HowToPlayPressHint pointer={pointer} />));
      });

      test("意味の名前に合う所に置くこと", () => {
        const { style } = getPointer(container);
        const shown = Object.fromEntries(
          Object.keys(placement).map((side) => [
            side,
            style.getPropertyValue(side),
          ]),
        );

        expect(shown).toEqual(placement);
      });
    });
  });

  describe("角を選ぶ場合", () => {
    const cases: readonly {
      pointer: "inside-corner" | "outside-corner";
      corner: HowToPlayPressHintCorner;
      placement: Partial<Record<"left" | "right" | "top" | "bottom", string>>;
    }[] = [
      {
        pointer: "inside-corner",
        corner: "bottom-left",
        placement: {
          bottom: "calc(var(--how-to-play-hint-unit) * 0.06)",
          left: "calc(var(--how-to-play-hint-unit) * 0.06)",
          right: "",
        },
      },
      {
        pointer: "outside-corner",
        corner: "top-right",
        placement: {
          top: "calc(var(--how-to-play-hint-pointer) * -0.5)",
          right: "calc(var(--how-to-play-hint-pointer) * -0.5)",
          bottom: "",
        },
      },
    ];

    describe.each(cases)(
      "$pointer を $corner に置く場合",
      ({ pointer, corner, placement }) => {
        let container: HTMLElement;

        beforeEach(() => {
          ({ container } = render(
            <HowToPlayPressHint pointer={pointer} corner={corner} />,
          ));
        });

        test("選んだ角に置き、ほかの角には寄せないこと", () => {
          const { style } = getPointer(container);
          const shown = Object.fromEntries(
            Object.keys(placement).map((side) => [
              side,
              style.getPropertyValue(side),
            ]),
          );

          expect(shown).toEqual(placement);
        });
      },
    );
  });

  describe("押す物そのものが指の絵の場合", () => {
    let container: HTMLElement;

    beforeEach(() => {
      ({ container } = render(<HowToPlayPressHint pointer="none" />));
    });

    test("破線の枠だけを描き、指を置かないこと", () => {
      const pointer = container.querySelector(
        "[data-how-to-play-press-hint-pointer]",
      );

      expect(pointer).toBeNull();
    });
  });

  describe("右ボタンで押す場合", () => {
    let container: HTMLElement;

    beforeEach(() => {
      ({ container } = render(
        <HowToPlayPressHint gesture="secondary-press" />,
      ));
    });

    test("指の代わりにマウスのアイコンを描くこと", () => {
      const icon = getPointer(container).getAttribute("class");

      expect(icon).toContain("lucide-mouse-right");
    });
  });

  describe("押すとなる姿を渡した場合", () => {
    let container: HTMLElement;

    beforeEach(() => {
      ({ container } = render(
        <HowToPlayPressHint hoverPreview={<span>押すと四角</span>} />,
      ));
    });

    test("押す物に重ねている間だけ、指を隠して押すとなる姿を見せること", () => {
      const preview =
        getHint(container).querySelector("span.opacity-0")?.className;
      const pointer = getPointer(container).getAttribute("class");

      expect([preview, pointer]).toEqual([
        expect.stringContaining(
          "pointer-fine:group-[:hover>&]/how-to-play-press-hint:opacity-30",
        ),
        expect.stringContaining(
          "pointer-fine:group-[:hover>&]/how-to-play-press-hint:opacity-0",
        ),
      ]);
    });
  });
});

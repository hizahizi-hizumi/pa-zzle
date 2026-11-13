import { cleanup, render } from "@testing-library/react";

import { TutorialCue } from "@/components/TutorialCue";

afterEach(cleanup);

function queryCues(kind: string): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[data-tutorial-cue="${kind}"]`),
  );
}

describe("TutorialCue", () => {
  describe("印の無い所が押されていない印の場合", () => {
    beforeEach(() => {
      render(<TutorialCue kind="mark" recallId={null} />);
    });

    test("押す物に沿う印だけを描き、印を戻す線を描かないこと", () => {
      const marks = queryCues("mark");
      const recalls = queryCues("recall");
      const pointers = queryCues("pointer");

      expect(marks).toHaveLength(1);
      expect(marks[0]?.getAttribute("aria-hidden")).toBe("true");
      expect(recalls).toHaveLength(0);
      expect(pointers).toHaveLength(0);
    });
  });

  describe("印の無い所が押された印の場合", () => {
    let rerender: ReturnType<typeof render>["rerender"];
    let firstRecall: HTMLElement | undefined;

    beforeEach(() => {
      ({ rerender } = render(<TutorialCue kind="mark" recallId={1} />));
      firstRecall = queryCues("recall")[0];
    });

    test("印に重ねて、印を戻す線を描くこと", () => {
      const marks = queryCues("mark");

      expect(marks).toHaveLength(1);
      expect(firstRecall).toBeDefined();
    });

    test("もう一度押されると、印を戻す線を描き直すこと", () => {
      rerender(<TutorialCue kind="mark" recallId={2} />);

      const recalls = queryCues("recall");

      expect(recalls).toHaveLength(1);
      expect(recalls[0]).not.toBe(firstRecall);
    });

    test("同じ押し方のまま描き直しても、印を戻す線を作り直さないこと", () => {
      rerender(<TutorialCue kind="mark" recallId={1} />);

      const recalls = queryCues("recall");

      expect(recalls).toEqual([firstRecall]);
    });
  });

  describe("指さしの場合", () => {
    let rerender: ReturnType<typeof render>["rerender"];

    beforeEach(() => {
      ({ rerender } = render(<TutorialCue kind="pointer" recallId={null} />));
    });

    test("押す物に沿う印に加えて、読み上げない指を描くこと", () => {
      const marks = queryCues("mark");
      const pointers = queryCues("pointer");

      expect(marks).toHaveLength(1);
      expect(pointers).toHaveLength(1);
      expect(pointers[0]?.getAttribute("aria-hidden")).toBe("true");
    });

    test("印の無い所が押されると、指を残したまま印を戻す線を描くこと", () => {
      rerender(<TutorialCue kind="pointer" recallId={1} />);

      const pointers = queryCues("pointer");
      const recalls = queryCues("recall");

      expect(pointers).toHaveLength(1);
      expect(recalls).toHaveLength(1);
    });

    test("置き場所を指定しないと、押す物のすぐ下に指を置き、押すしぐさに波紋を添えること", () => {
      const pointer = queryCues("pointer")[0];
      const ripple = pointer?.querySelector(".animate-tutorial-tap-ripple");

      expect(pointer?.getAttribute("data-placement")).toBe("below");
      expect(ripple).not.toBeNull();
    });
  });

  describe("押す物の中央を指す指さしの場合", () => {
    beforeEach(() => {
      render(<TutorialCue kind="pointer" recallId={null} placement="center" />);
    });

    test("押す物の中央に指を置き、印も描くこと", () => {
      const marks = queryCues("mark");
      const pointer = queryCues("pointer")[0];

      expect(marks).toHaveLength(1);
      expect(pointer?.getAttribute("data-placement")).toBe("center");
    });

    test("押す物に重なって盤面の物に見えないよう、波紋を描かないこと", () => {
      const pointer = queryCues("pointer")[0];
      const ripple = pointer?.querySelector(".animate-tutorial-tap-ripple");

      expect(pointer).toBeDefined();
      expect(ripple).toBeNull();
    });
  });

  describe("スワイプの向きを渡した指さしの場合", () => {
    beforeEach(() => {
      render(<TutorialCue kind="pointer" recallId={null} swipe="left" />);
    });

    test("印を描き、指に滑る向きを持たせること", () => {
      const marks = queryCues("mark");
      const pointer = queryCues("pointer")[0];

      expect(marks).toHaveLength(1);
      expect(pointer?.getAttribute("data-swipe")).toBe("left");
    });

    test("押すしぐさと取り違えないよう、波紋を描かないこと", () => {
      const pointer = queryCues("pointer")[0];
      const ripple = pointer?.querySelector(".animate-tutorial-tap-ripple");

      expect(pointer).toBeDefined();
      expect(ripple).toBeNull();
    });
  });

  describe("輪郭を描かない指さしの場合", () => {
    beforeEach(() => {
      render(
        <TutorialCue kind="pointer" recallId={1} swipe="up" outlined={false} />,
      );
    });

    test("着く所の印と並んでも印が1つに見えるよう、指だけを描くこと", () => {
      const pointers = queryCues("pointer");
      const marks = queryCues("mark");
      const recalls = queryCues("recall");

      expect(pointers).toHaveLength(1);
      expect(marks).toHaveLength(0);
      expect(recalls).toHaveLength(0);
    });
  });

  describe("仕上げたことへの応えの場合", () => {
    beforeEach(() => {
      render(<TutorialCue kind="achievement" />);
    });

    test("次に押す所の印を描かず、読み上げない仕上げた印を描くこと", () => {
      const achievements = queryCues("achievement");
      const marks = queryCues("mark");

      expect(achievements).toHaveLength(1);
      expect(achievements[0]?.getAttribute("aria-hidden")).toBe("true");
      expect(marks).toHaveLength(0);
    });
  });

  describe("手が成立した瞬間の合図の場合", () => {
    let rerender: ReturnType<typeof render>["rerender"];
    let firstAcknowledgement: HTMLElement | undefined;

    beforeEach(() => {
      ({ rerender } = render(<TutorialCue kind="acknowledgement" id={1} />));
      firstAcknowledgement = queryCues("acknowledgement")[0];
    });

    test("印を描かず、合図だけを描くこと", () => {
      const marks = queryCues("mark");

      expect(marks).toHaveLength(0);
      expect(firstAcknowledgement).toBeDefined();
    });

    test("次の手が成立すると、合図を描き直すこと", () => {
      rerender(<TutorialCue kind="acknowledgement" id={2} />);

      const acknowledgements = queryCues("acknowledgement");

      expect(acknowledgements).toHaveLength(1);
      expect(acknowledgements[0]).not.toBe(firstAcknowledgement);
    });
  });
});

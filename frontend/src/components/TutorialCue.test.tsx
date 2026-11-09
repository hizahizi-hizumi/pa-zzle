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

      expect(marks).toHaveLength(1);
      expect(marks[0]?.getAttribute("aria-hidden")).toBe("true");
      expect(recalls).toHaveLength(0);
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

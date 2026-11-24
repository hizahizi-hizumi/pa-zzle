import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { HowToPlayExamplePanel } from "@/components/HowToPlayExamplePanel";
import {
  emptyColumnExamples,
  moveOperationExample,
  runAmountExamples,
  stackDestinationExample,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/figure-boards";
import {
  TouchableExample,
  type TouchableExampleCaption,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/TouchableExample";

/** 札を動かした要素を記録する。 */
const animated: HTMLElement[] = [];

beforeEach(() => {
  animated.length = 0;
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value(this: HTMLElement) {
      animated.push(this);
      return {
        finished: new Promise<void>(() => undefined),
        finish() {},
        cancel() {},
      } as unknown as Animation;
    },
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, "animate");
  vi.unstubAllGlobals();
});

const placeCaption = {
  kind: "verdict",
  labels: { allowed: "置ける", disallowed: "置けない" },
  movedLabels: { allowed: "置けた", disallowed: "置けない" },
} as const satisfies TouchableExampleCaption;

/** 押す山。本番の盤面と同じ読み上げ名で探す。 */
function getPile(name: RegExp): HTMLElement {
  return screen.getByRole("button", { name });
}

/** 図の下に見えている言葉。入れ替える言葉の層のうち、見せている層だけを読む。 */
function readShownCaptions(): string[] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      '[data-how-to-play-caption-layer]:not([aria-hidden="true"])',
    ),
  ].map((layer) => layer.textContent ?? "");
}

function readHintedPiles(): (string | null)[] {
  return [...document.querySelectorAll("[data-hinted-pile]")].map((hint) =>
    hint.getAttribute("data-hinted-pile"),
  );
}

function getResetButton(): HTMLElement {
  return screen.getByRole("button", { name: "例を元に戻す" });
}

describe("列に重ねる例の場合", () => {
  beforeEach(() => {
    render(
      <HowToPlayExamplePanel resettable>
        <TouchableExample
          example={stackDestinationExample}
          caption={{ kind: "columns" }}
        />
      </HowToPlayExamplePanel>,
    );
  });

  test("押す前から、列ごとに置けるかと置けないわけを添えること", () => {
    const answers = screen
      .getAllByText(/^列\d: /)
      .map((answer) => answer.textContent);
    const reasons = [
      screen.queryByText("同じ色"),
      screen.queryByText("数違い"),
    ];

    expect(answers).toEqual(["列2: 置ける", "列3: 置けない", "列4: 置けない"]);
    expect(reasons.every((reason) => reason !== null)).toBe(true);
  });

  test("最初は置き先の列に手がかりを付けること", () => {
    const hinted = readHintedPiles();

    expect(hinted).toEqual(["column"]);
  });

  test("置けない列を押すと、選んだ札を当てて戻し、手がかりを消すこと", () => {
    fireEvent.click(getPile(/^列3、/));

    expect(animated.length).toBeGreaterThan(0);
    expect(readHintedPiles()).toEqual([]);
    expect(getPile(/^列1、/).getAttribute("aria-pressed")).toBe("true");
  });

  test("置ける列を押すと、札を移して置いた列に置けたと添え、元に戻すボタンを使えるようにすること", () => {
    fireEvent.click(getPile(/^列2、/));

    expect(getPile(/^列2、/).getAttribute("aria-label")).toBe("列2、♠8 ♥7");
    expect(screen.getByText("列2: 置けた")).toBeTruthy();
    expect(animated.length).toBeGreaterThan(0);
    expect(getResetButton().hasAttribute("disabled")).toBe(false);
  });
});

describe("空いた列の対の場合", () => {
  beforeEach(() => {
    render(
      <HowToPlayExamplePanel resettable>
        <TouchableExample
          example={emptyColumnExamples[0]}
          caption={placeCaption}
        />
        <TouchableExample
          example={emptyColumnExamples[1]}
          caption={placeCaption}
        />
      </HowToPlayExamplePanel>,
    );
  });

  test("押す前は、例が見せる手を本番の判定で判定すること", () => {
    const captions = readShownCaptions();

    expect(captions).toEqual(["置ける", "置けない"]);
  });

  test("置いた後は、試した手の結果として置けたと言うこと", () => {
    const [left] = screen.getAllByRole("button", { name: /^列2、空/ });

    fireEvent.click(left!);

    expect(readShownCaptions()).toEqual(["置けた", "置けない"]);
  });
});

describe("並びの対の場合", () => {
  beforeEach(() => {
    render(
      <HowToPlayExamplePanel resettable>
        <TouchableExample
          example={runAmountExamples[0]}
          caption={{ kind: "amount" }}
        />
        <TouchableExample
          example={runAmountExamples[1]}
          caption={{ kind: "amount" }}
        />
      </HowToPlayExamplePanel>,
    );
  });

  test("押す前は、置く先で決まる動く枚数を添えること", () => {
    const captions = readShownCaptions();

    expect(captions).toEqual(["3枚が動く", "2枚が動く"]);
  });

  test("動かした後は、動いた枚数を添えること", () => {
    fireEvent.click(getPile(/^列2、♣9/));

    expect(readShownCaptions()).toEqual(["3枚が動く", "2枚が動いた"]);
  });
});

describe("動かし方の例の場合", () => {
  beforeEach(() => {
    render(
      <HowToPlayExamplePanel resettable>
        <TouchableExample example={moveOperationExample} />
      </HowToPlayExamplePanel>,
    );
  });

  test("置き元を選ぶと、手がかりを置き先へ移すこと", () => {
    fireEvent.click(getPile(/^列1、/));

    const hint = document.querySelector("[data-hinted-pile]");
    expect(hint?.getAttribute("data-hinted-pile")).toBe("column");
    expect(getPile(/^列1、/).getAttribute("aria-pressed")).toBe("true");
  });

  test("元に戻すと、最初の盤面と手がかりに戻すこと", () => {
    fireEvent.click(getPile(/^列1、/));
    fireEvent.click(getPile(/^列2、/));

    fireEvent.click(getResetButton());

    expect(getPile(/^列1、/).getAttribute("aria-label")).toBe("列1、♣4 ♠9 ♥8");
    expect(readHintedPiles()).toEqual(["column"]);
  });
});

describe("札の無い山を選ぼうとした場合", () => {
  beforeEach(() => {
    render(
      <HowToPlayExamplePanel resettable>
        <TouchableExample
          example={emptyColumnExamples[0]}
          caption={placeCaption}
        />
      </HowToPlayExamplePanel>,
    );
  });

  test("本番と同じく山を揺らし、判定の下に札が無いことを添えること", () => {
    fireEvent.click(getPile(/^列1、/));

    fireEvent.click(getPile(/^列2、空/));

    const verdict = document.querySelector("[data-how-to-play-verdict]");
    expect(within(verdict as HTMLElement).getByText("札が無い")).toBeTruthy();
    expect(animated).toContain(getPile(/^列2、空/));
  });
});

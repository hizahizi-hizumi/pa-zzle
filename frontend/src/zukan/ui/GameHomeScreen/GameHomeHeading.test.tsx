import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { MemoryRouter } from "react-router";

import { GameHomeHeading } from "@/zukan/ui/GameHomeScreen/GameHomeHeading";

describe("GameHomeHeading", () => {
  const pictogramSvg =
    '<svg xmlns="http://www.w3.org/2000/svg"><rect data-testid="mono"/></svg>';
  const pictogramShowcaseSvg =
    '<svg xmlns="http://www.w3.org/2000/svg"><rect data-testid="showcase"/></svg>';

  function renderHeading(showcaseSvg: string | undefined) {
    render(
      <MemoryRouter>
        <GameHomeHeading
          gameId="nanpure"
          gameTitle="ナンプレ"
          pictogramSvg={pictogramSvg}
          pictogramShowcaseSvg={showcaseSvg}
          shownMilestone={{ solvedCount: 3, previous: 0, next: 10 }}
          titleRef={createRef()}
          actionsRef={createRef()}
        >
          <button type="button">メニュー</button>
        </GameHomeHeading>
      </MemoryRouter>,
    );
  }

  describe("色と動きのあるピクトグラムを持つゲームの場合", () => {
    beforeEach(() => {
      renderHeading(pictogramShowcaseSvg);
    });

    test("色と動きのあるピクトグラムを、動きを再生する姿で見せること", () => {
      const showcase = screen.getByTestId("showcase");
      const mono = screen.queryByTestId("mono");

      expect(showcase.closest('[data-pictogram-motion="play"]')).not.toBeNull();
      expect(mono).toBeNull();
    });

    test("解いた問題の数を、全問の数ではなく次の節目までの残りと並べて示すこと", () => {
      const count = screen.getByText("解いた問題 3問", { exact: false });

      expect(count.textContent).toBe("解いた問題 3問 · 10問まであと7問");
    });
  });

  describe("色と動きのあるピクトグラムを持たないゲームの場合", () => {
    beforeEach(() => {
      renderHeading(undefined);
    });

    test("濃淡2色のピクトグラムを、動かさずに見せること", () => {
      const mono = screen.getByTestId("mono");

      expect(mono.closest("[data-pictogram-motion]")).toBeNull();
    });
  });
});

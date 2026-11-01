import { cleanup, render, screen } from "@testing-library/react";

import type { TsumeShogiPlayedMove } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import type { TsumeShogiSessionPhase } from "@/games/tsume-shogi/session/session";
import { TsumeShogiPlayStatus } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiPlayStatus";

const refutedMoves: readonly TsumeShogiPlayedMove[] = [
  {
    side: "attacker",
    move: { kind: "drop", pieceType: "gold", to: { file: 2, rank: 1 } },
    pieceType: "gold",
    promotable: false,
    line: "wrong",
  },
  {
    side: "defender",
    move: {
      kind: "board",
      from: { file: 2, rank: 2 },
      to: { file: 2, rank: 1 },
      promote: false,
    },
    pieceType: "king",
    promotable: false,
    line: "wrong",
  },
];

afterEach(() => {
  cleanup();
});

function renderStatus(phase: TsumeShogiSessionPhase): void {
  render(
    <TsumeShogiPlayStatus
      plies={3}
      phase={phase}
      shownMoves={refutedMoves}
      precedingMoveTo={null}
    />,
  );
}

describe("TsumeShogiPlayStatus", () => {
  describe("誤王手の筋で手数が尽きた場合", () => {
    beforeEach(() => {
      renderStatus("refuted");
    });

    test("反証と、その手数では詰まないことを示すこと", () => {
      const status = screen.getByRole("status").textContent;

      expect(status).toContain("△同玉");
      expect(status).toContain("3手では詰みません");
    });
  });

  describe("誤王手の筋でまだ指せる場合", () => {
    beforeEach(() => {
      renderStatus("attacker");
    });

    test("反証で逃れたことだけを示すこと", () => {
      const status = screen.getByRole("status").textContent;

      expect(status).toContain("△同玉で逃れる");
      expect(status).not.toContain("詰みません");
    });
  });
});

import { cleanup, render } from "@testing-library/react";

import {
  selectTsugeFace,
  type TsumeShogiPieceDefIds,
  TsumeShogiPieceDefs,
  useTsumeShogiPieceDefIds,
} from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";

afterEach(cleanup);

describe("selectTsugeFace", () => {
  const ids = {
    faces: ["a", "b", "c", "d", "e", "f", "g", "h"],
    edge: "edge",
    shade: "shade",
    specular: "specular",
    liftedShadowBlur: "liftedShadowBlur",
    ink: "ink",
    vermilion: "vermilion",
    glyphs: {} as TsumeShogiPieceDefIds["glyphs"],
  } satisfies TsumeShogiPieceDefIds;
  const seeds = Array.from({ length: 40 }, (_, index) => `piece-${index}`);

  test("同じ識別には同じ木目を返すこと", () => {
    const first = selectTsugeFace(ids, "piece-3");
    const second = selectTsugeFace(ids, "piece-3");

    expect(second).toBe(first);
  });

  test("盤に並ぶほどの駒の数で、木目の模様を偏らずに使うこと", () => {
    const used = new Set(seeds.map((seed) => selectTsugeFace(ids, seed)));

    expect(used.size).toBeGreaterThanOrEqual(6);
  });
});

describe("TsumeShogiPieceDefs", () => {
  let receivedIds: TsumeShogiPieceDefIds | null;
  let container: HTMLElement;

  function Probe() {
    receivedIds = useTsumeShogiPieceDefIds();
    return null;
  }

  beforeEach(() => {
    receivedIds = null;
    ({ container } = render(
      <TsumeShogiPieceDefs>
        <Probe />
      </TsumeShogiPieceDefs>,
    ));
  });

  test("内側の駒が参照する id の塗りと字形を置くこと", () => {
    const referenced = [
      ...(receivedIds?.faces ?? []),
      receivedIds?.edge,
      receivedIds?.shade,
      receivedIds?.specular,
      receivedIds?.liftedShadowBlur,
      receivedIds?.ink,
      receivedIds?.vermilion,
      ...Object.values(receivedIds?.glyphs ?? {}),
    ];

    const missing = referenced.filter(
      (id) => !id || !container.ownerDocument.getElementById(id),
    );

    expect(referenced).toHaveLength(8 + 6 + 14);
    expect(missing).toEqual([]);
  });
});

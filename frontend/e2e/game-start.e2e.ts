import type { Page } from "@playwright/test";
import { HITOFUDE_PUZZLE_DISPLAY_NAME } from "@/games/hitofude-puzzle/display-name";
import { ICE_FLOOR_MAZE_DISPLAY_NAME } from "@/games/ice-floor-maze/display-name";
import { MINESWEEPER_DISPLAY_NAME } from "@/games/minesweeper/display-name";
import { NANPURE_DISPLAY_NAME } from "@/games/nanpure/display-name";
import { PARKING_JAM_DISPLAY_NAME } from "@/games/parking-jam/display-name";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import { SLIDE_PUZZLE_DISPLAY_NAME } from "@/games/slide-puzzle/display-name";
import { TAKUZU_DISPLAY_NAME } from "@/games/takuzu/display-name";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import { WATER_SORT_DISPLAY_NAME } from "@/games/water-sort/display-name";
import { expect, test } from "./fixtures";

// ゲームごとに別のテストにして並べて動かすため、テストを集める時点で一覧が要る。
// タイトルに並ぶゲームとの一致を下のテストで確かめ、ゲームを足したときに一覧の更新漏れで検査から外れないようにする。
const games = [
  { id: "water-sort", name: WATER_SORT_DISPLAY_NAME },
  { id: "nanpure", name: NANPURE_DISPLAY_NAME },
  { id: "minesweeper", name: MINESWEEPER_DISPLAY_NAME },
  { id: "parking-jam", name: PARKING_JAM_DISPLAY_NAME },
  { id: "slide-puzzle", name: SLIDE_PUZZLE_DISPLAY_NAME },
  { id: "takuzu", name: TAKUZU_DISPLAY_NAME },
  { id: "reflection", name: REFLECTION_DISPLAY_NAME },
  { id: "hitofude-puzzle", name: HITOFUDE_PUZZLE_DISPLAY_NAME },
  { id: "ice-floor-maze", name: ICE_FLOOR_MAZE_DISPLAY_NAME },
  { id: "tsume-shogi", name: TSUME_SHOGI_DISPLAY_NAME },
] as const;

const playLinkNameSuffix = "を遊ぶ";

async function openTitle(page: Page) {
  await page.goto("/");
  const title = page.getByRole("dialog", { name: "pa-zzle" });
  await expect(
    title.getByRole("button", { name: "タップしてはじめる" }),
  ).toBeVisible();
  return title;
}

test("タイトルに並ぶゲームが、プレイを始める検査の対象とそろっている", async ({
  page,
}) => {
  const title = await openTitle(page);
  const playLinks = title.getByRole("listitem").getByRole("link");
  await expect(playLinks).toHaveCount(games.length);
  for (const [index, game] of games.entries()) {
    await expect(playLinks.nth(index)).toHaveAccessibleName(
      `${game.name}${playLinkNameSuffix}`,
    );
  }
});

for (const game of games) {
  test(`タイトルから${game.name}のホームを経てプレイを始められる`, async ({
    page,
    press,
    captureScreen,
  }) => {
    const title = await openTitle(page);
    await press(
      title.getByRole("link", { name: `${game.name}${playLinkNameSuffix}` }),
    );
    await expect(title).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/puzzles/${game.id}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: game.name }),
    ).toBeVisible();

    await press(page.getByRole("button", { name: "ランダムに遊ぶ" }));
    await expect(page).toHaveURL(
      new RegExp(`/puzzles/${game.id}/play/\\d\\?problem=\\w+$`),
    );
    await expect(
      page.getByRole("heading", { level: 1, name: game.name }),
    ).toBeVisible();
    await captureScreen(`play-${game.id}`);
  });
}

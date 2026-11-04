import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { listReflectionSolutionPlacements } from "./reflection-solution";

const gameName = "リフレクション";
const firstProblemNumber = "No.0001";

function readProblemId(page: Page): string {
  const problemId = new URL(page.url()).searchParams.get("problem");
  if (problemId === null) {
    throw new Error(`プレイ画面の URL に問題 ID がない: ${page.url()}`);
  }
  return problemId;
}

async function readViewportPosition(page: Page) {
  return page.evaluate(() => ({
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    scale: window.visualViewport?.scale ?? 1,
  }));
}

test("タイトルから入り、選んだゲームを解いて、そのプレイを記録で振り返れる", async ({
  page,
  press,
  captureScreen,
}) => {
  await test.step("タイトルで効果音を読み込み終えてから入る", async () => {
    await page.goto("/");
    const title = page.getByRole("dialog", { name: "pa-zzle" });
    const enterButton = title.getByRole("button", {
      name: "タップしてはじめる",
    });
    await expect(enterButton).toBeVisible();
    await captureScreen("01-title");
    await press(enterButton);
    await expect(title).toBeHidden();
  });

  await test.step("ホームでゲームを選んでゲームのホームへ入る", async () => {
    await expect(
      page.getByRole("heading", { level: 1, name: "パズル選択" }),
    ).toBeVisible();
    const gameChoice = page
      .getByRole("navigation", { name: "パズル一覧" })
      .getByRole("button", { name: `${gameName}を選択` });
    await press(gameChoice);
    await expect(gameChoice).toHaveAttribute("aria-pressed", "true");
    await captureScreen("02-home");
    await press(page.getByRole("link", { name: `${gameName}を遊ぶ` }));
    await expect(
      page.getByRole("heading", { level: 1, name: gameName }),
    ).toBeVisible();
  });

  await test.step("図鑑の最初の問題を選んで始める", async () => {
    await expect(
      page.getByRole("tab", { selected: true }),
    ).toHaveAccessibleName(/^レベル 1 /);
    await press(
      page.getByRole("button", { name: new RegExp(`^${firstProblemNumber} `) }),
    );
    await captureScreen("03-game-home");
    await press(page.getByRole("button", { name: "遊ぶ", exact: true }));
    await expect(page).toHaveURL(/\/puzzles\/reflection\/play\/1\?problem=/);
    await expect(
      page.getByRole("group", { name: `${gameName}盤面` }),
    ).toBeVisible();
    await captureScreen("04-play");
  });

  await test.step("解のとおりにピースを置いてクリアする", async () => {
    const viewportBeforePlay = await readViewportPosition(page);
    const board = page.getByRole("group", { name: `${gameName}盤面` });
    const stock = page.getByRole("group", { name: /^ストック/ });
    for (const placement of listReflectionSolutionPlacements(
      "1",
      readProblemId(page),
    )) {
      const stockPiece = stock.getByRole("button", {
        name: new RegExp(`^${placement.stockPieceName} `),
      });
      if ((await stockPiece.getAttribute("aria-pressed")) !== "true") {
        await press(stockPiece);
      }
      // それまでに押した操作が、ページの送りや拡大として受け取られていないこと（NFR-013）。
      // 最後の1手のあとはクリアして結果画面へ移るので、置く前に確かめる。
      expect(await readViewportPosition(page)).toEqual(viewportBeforePlay);
      await press(board.getByRole("button", { name: placement.emptyCellName }));
    }
  });

  await test.step("結果画面にそのプレイの結果が出る", async () => {
    await expect(page).toHaveURL(/\/puzzles\/reflection\/result\//);
    const result = page.getByRole("region", { name: "プレイ結果" });
    await expect(
      result.getByRole("heading", { level: 1, name: "プレイ結果" }),
    ).toBeVisible();
    await expect(result.getByText(gameName, { exact: true })).toBeVisible();
    await expect(result.getByText("難易度レベル 1")).toBeVisible();
    await expect(
      result.getByRole("button", { name: "次の問題" }),
    ).toBeVisible();
    await captureScreen("05-result");
  });

  await test.step("ホームから記録を開くと、そのプレイが出る", async () => {
    await press(page.getByRole("link", { name: "パズル選択" }));
    await expect(page.getByRole("dialog", { name: "pa-zzle" })).toHaveCount(0);
    await press(page.getByRole("link", { name: "記録", exact: true }));
    await expect(
      page.getByRole("heading", { level: 1, name: "記録" }),
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "遊んだ日" }).getByRole("button", {
        name: new RegExp(`^${gameName} レベル 1 ${firstProblemNumber} `),
      }),
    ).toHaveCount(1);
    await captureScreen("06-records");
  });
});

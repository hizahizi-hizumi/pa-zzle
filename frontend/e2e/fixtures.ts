import { fileURLToPath } from "node:url";
import { test as base, expect, type Locator } from "@playwright/test";

const screenshotRoot = fileURLToPath(
  new URL("../e2e-results/screenshots/", import.meta.url),
);

type BrowserErrorLog = {
  pageErrors: string[];
  consoleErrors: string[];
};

type E2eFixtures = {
  browserErrors: BrowserErrorLog;
  /** タッチのある端末では指で、それ以外ではマウスで押す。 */
  press: (target: Locator) => Promise<void>;
  /** 画面のスクリーンショットを、体験確認の資料としてプロジェクトごとに残す。 */
  captureScreen: (name: string) => Promise<void>;
};

export const test = base.extend<E2eFixtures>({
  browserErrors: [
    async function browserErrors({ page }, use) {
      const log: BrowserErrorLog = { pageErrors: [], consoleErrors: [] };
      page.on("pageerror", (error) => {
        log.pageErrors.push(error.stack ?? error.message);
      });
      page.on("console", (message) => {
        if (message.type() === "error") {
          log.consoleErrors.push(message.text());
        }
      });
      await use(log);
      expect(log.pageErrors, "ページで捕まらなかった例外").toEqual([]);
      expect(log.consoleErrors, "コンソールのエラー").toEqual([]);
    },
    { auto: true },
  ],
  async press({ hasTouch }, use) {
    await use(async function press(target) {
      if (hasTouch) {
        await target.tap();
      } else {
        await target.click();
      }
    });
  },
  async captureScreen({ page }, use, testInfo) {
    await use(async function captureScreen(name) {
      await page.screenshot({
        path: `${screenshotRoot}${testInfo.project.name}/${name}.png`,
        fullPage: true,
      });
    });
  },
});

export { expect };

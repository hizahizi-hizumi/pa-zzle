import { createMemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  _private,
  followHomeOrigin,
  readHomeOriginGameId,
} from "@/app/navigation/home-origin";

const routes = [
  { path: "/", element: null },
  { path: "/records", element: null },
  { path: "/puzzles/:game", element: null },
  { path: "/puzzles/:game/result/:recordId", element: null },
];

afterEach(() => {
  _private.resetForTest();
});

describe("readHomeOriginGameId", () => {
  let router: ReturnType<typeof createMemoryRouter>;
  let stopFollowing: () => void;

  afterEach(() => {
    stopFollowing();
  });

  describe("アプリをホームで開いた場合", () => {
    beforeEach(() => {
      router = createMemoryRouter(routes, { initialEntries: ["/"] });
      stopFollowing = followHomeOrigin(router);
    });

    test("ゲームの画面から来ていないとして null を返すこと", () => {
      const gameId = readHomeOriginGameId();

      expect(gameId).toBeNull();
    });
  });

  describe("ゲームのホームからホームへ移った場合", () => {
    beforeEach(async () => {
      router = createMemoryRouter(routes, {
        initialEntries: ["/puzzles/nanpure"],
      });
      stopFollowing = followHomeOrigin(router);
      await router.navigate("/");
    });

    test("来る前にいたゲームを返すこと", () => {
      const gameId = readHomeOriginGameId();

      expect(gameId).toBe("nanpure");
    });
  });

  describe("結果からホームへ移った場合", () => {
    beforeEach(async () => {
      router = createMemoryRouter(routes, {
        initialEntries: ["/puzzles/takuzu/result/r-1"],
      });
      stopFollowing = followHomeOrigin(router);
      await router.navigate("/");
    });

    test("結果のゲームを返すこと", () => {
      const gameId = readHomeOriginGameId();

      expect(gameId).toBe("takuzu");
    });
  });

  describe("ホームからゲームのホームへ入り、ブラウザの戻るでホームへ戻った場合", () => {
    beforeEach(async () => {
      router = createMemoryRouter(routes, { initialEntries: ["/"] });
      stopFollowing = followHomeOrigin(router);
      await router.navigate("/puzzles/nanpure");
      await router.navigate(-1);
    });

    test("戻る前にいたゲームを返すこと", () => {
      const gameId = readHomeOriginGameId();

      expect(gameId).toBe("nanpure");
    });
  });

  describe("ゲームの画面からホームへ戻ったあと、ゲームではない画面を経てホームへ来た場合", () => {
    beforeEach(async () => {
      router = createMemoryRouter(routes, {
        initialEntries: ["/puzzles/nanpure"],
      });
      stopFollowing = followHomeOrigin(router);
      await router.navigate("/");
      await router.navigate("/records");
      await router.navigate("/");
    });

    test("null を返すこと", () => {
      const gameId = readHomeOriginGameId();

      expect(gameId).toBeNull();
    });
  });
});

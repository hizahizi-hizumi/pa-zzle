import {
  markHakoiriMusumeElementHintSeen,
  readSeenHakoiriMusumeElementHints,
} from "@/games/hakoiri-musume/ui/HakoiriMusumePlay/element-hint-storage";

const storageKey = "pa-zzle.hakoiri-musume.element-hints.v1";

afterEach(() => {
  window.localStorage.clear();
});

describe("readSeenHakoiriMusumeElementHints", () => {
  describe("今は出さない要素の ID が残っている場合", () => {
    beforeEach(() => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(["wall", "two-targets", "large-board"]),
      );
    });

    test("今の要素の ID だけを読むこと", () => {
      const seen = readSeenHakoiriMusumeElementHints();

      expect([...seen]).toEqual(["two-targets"]);
    });
  });

  describe("読めない値が残っている場合", () => {
    beforeEach(() => {
      window.localStorage.setItem(storageKey, "{");
    });

    test("まだどれも出していないとみなすこと", () => {
      const seen = readSeenHakoiriMusumeElementHints();

      expect(seen.size).toBe(0);
    });
  });
});

describe("markHakoiriMusumeElementHintSeen", () => {
  describe("今は出さない要素の ID だけが残っている場合", () => {
    beforeEach(() => {
      window.localStorage.setItem(storageKey, JSON.stringify(["wall"]));
    });

    test("出した要素の ID を残すこと", () => {
      markHakoiriMusumeElementHintSeen("two-targets");
      const seen = readSeenHakoiriMusumeElementHints();

      expect([...seen]).toEqual(["two-targets"]);
    });
  });
});

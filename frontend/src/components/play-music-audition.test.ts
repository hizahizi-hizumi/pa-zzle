import {
  _private,
  playMusicAuditionCandidates,
  selectPlayMusicAuditionCandidate,
} from "@/components/play-music-audition";

const storageKey = "pa-zzle.play-music-audition.v1";

afterEach(() => {
  selectPlayMusicAuditionCandidate(playMusicAuditionCandidates[0]);
  window.localStorage.clear();
});

describe("readPlayMusicAuditionCandidate", () => {
  describe("候補を保存していない端末の場合", () => {
    test("候補 A を返すこと", () => {
      const candidate = _private.readPlayMusicAuditionCandidate();

      expect(candidate.id).toBe("A");
    });
  });

  describe("候補を選んだ場合", () => {
    beforeEach(() => {
      const selected = playMusicAuditionCandidates.find(({ id }) => id === "C");
      if (selected) {
        selectPlayMusicAuditionCandidate(selected);
      }
    });

    test("読み込み直しても選んだ候補を返すこと", () => {
      const candidate = _private.readPlayMusicAuditionCandidate();

      expect(candidate.id).toBe("C");
      expect(window.localStorage.getItem(storageKey)).toBe("C");
    });
  });

  describe("今の候補に無い候補を保存している場合", () => {
    beforeEach(() => {
      window.localStorage.setItem(storageKey, "Z");
    });

    test("候補 A を返すこと", () => {
      const candidate = _private.readPlayMusicAuditionCandidate();

      expect(candidate.id).toBe("A");
    });
  });
});

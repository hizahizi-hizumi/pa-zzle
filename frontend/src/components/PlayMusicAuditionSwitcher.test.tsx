import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { PlayMusicAuditionSwitcher } from "@/components/PlayMusicAuditionSwitcher";
import {
  playMusicAuditionCandidates,
  selectPlayMusicAuditionCandidate,
} from "@/components/play-music-audition";

const switcherName = "プレイ中の曲の候補（試聴用）";

afterEach(() => {
  selectPlayMusicAuditionCandidate(playMusicAuditionCandidates[0]);
  window.localStorage.clear();
});

describe("PlayMusicAuditionSwitcher", () => {
  beforeEach(() => {
    render(
      <MemoryRouter initialEntries={["/puzzles/nanpure/play/3"]}>
        <PlayMusicAuditionSwitcher />
      </MemoryRouter>,
    );
  });

  test("候補を記号と名前で並べること", () => {
    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(options).toEqual(["D 鐘の音型", "E パルスの音型"]);
  });

  test("選んだ候補に切り替えること", () => {
    const switcher = screen.getByLabelText<HTMLSelectElement>(switcherName);

    fireEvent.change(switcher, { target: { value: "E" } });

    expect(switcher.value).toBe("E");
  });
});

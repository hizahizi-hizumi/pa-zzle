type StreamPlayers = typeof import("@/lib/background-music/stream-players");

/** 再生を許すかを、テストごとに決められる `<audio>` 要素。 */
class FakeAudio {
  static instances: FakeAudio[] = [];
  static allowsPlay = true;
  src = "";
  preload = "";
  loop = false;
  currentTime = 0;
  error = null;
  play = vi.fn(() =>
    FakeAudio.allowsPlay
      ? Promise.resolve()
      : Promise.reject(new DOMException("操作が要る", "NotAllowedError")),
  );
  pause = vi.fn();
  load = vi.fn();

  constructor() {
    FakeAudio.instances.push(this);
  }

  addEventListener() {}

  removeAttribute(name: string) {
    if (name === "src") {
      this.src = "";
    }
  }
}

const context = {
  createMediaElementSource: vi.fn((element: FakeAudio) => ({
    context,
    element,
  })),
} as unknown as AudioContext;

/** 再生の結果を受け取るのを待つ。 */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function importStreamPlayers(): Promise<StreamPlayers> {
  vi.resetModules();
  return import("@/lib/background-music/stream-players");
}

beforeEach(() => {
  vi.stubGlobal("Audio", FakeAudio);
  FakeAudio.allowsPlay = true;
});

afterEach(() => {
  FakeAudio.instances = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getStreamPlayer", () => {
  let streamPlayers: StreamPlayers;

  beforeEach(async () => {
    streamPlayers = await importStreamPlayers();
  });

  test("ファイルが無ければ、曲の URL を先に読み込ませること", () => {
    const player = streamPlayers.getStreamPlayer("/home.mp3", null);

    expect(player?.element).toMatchObject({
      src: "/home.mp3",
      preload: "auto",
      loop: true,
    });
  });

  describe("曲のファイルを持っている場合", () => {
    const file = new Blob(["home"]);

    beforeEach(() => {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:home");
    });

    test("ネットワークから読み込まず、ファイルを読み込ませること", () => {
      const player = streamPlayers.getStreamPlayer("/home.mp3", file);

      expect(player?.element.src).toBe("blob:home");
    });
  });

  describe("全ての要素を使っている場合", () => {
    beforeEach(() => {
      for (const url of ["/home.mp3", "/result.mp3"]) {
        const player = streamPlayers.getStreamPlayer(url, null);
        if (player) {
          streamPlayers.playStreamPlayer(player);
        }
      }
    });

    test("要素を返さないこと", () => {
      const player = streamPlayers.getStreamPlayer("/other.mp3", null);

      expect(player).toBeNull();
    });
  });
});

describe("unlockStreamPlayers", () => {
  let streamPlayers: StreamPlayers;

  beforeEach(async () => {
    streamPlayers = await importStreamPlayers();
  });

  test("使い回す全ての要素を、音を AudioContext へ通してから一度再生して止めること", () => {
    streamPlayers.unlockStreamPlayers(context);

    expect(
      FakeAudio.instances.map(({ play, pause }) => ({
        played: play.mock.calls.length,
        paused: pause.mock.calls.length,
      })),
    ).toEqual([
      { played: 1, paused: 1 },
      { played: 1, paused: 1 },
    ]);
    expect(context.createMediaElementSource).toHaveBeenCalledTimes(2);
  });

  describe("全ての要素の再生を許された場合", () => {
    beforeEach(async () => {
      streamPlayers.unlockStreamPlayers(context);
      await settle();
    });

    test("もう操作を待たないこと", () => {
      const needsGesture = streamPlayers.streamPlayersNeedUserGesture();

      expect(needsGesture).toBe(false);
    });
  });

  describe("操作の外で再生を拒まれた要素がある場合", () => {
    let onChange: ReturnType<typeof vi.fn<() => void>>;
    let player: ReturnType<StreamPlayers["getStreamPlayer"]>;

    beforeEach(async () => {
      onChange = vi.fn<() => void>();
      streamPlayers.listenForStreamPlayerChanges(onChange);
      FakeAudio.allowsPlay = false;
      player = streamPlayers.getStreamPlayer("/home.mp3", null);
      if (player) {
        streamPlayers.playStreamPlayer(player);
      }
      await settle();
      FakeAudio.allowsPlay = true;
    });

    test("拒まれたことを知らせ、操作を待つこと", () => {
      const needsGesture = streamPlayers.streamPlayersNeedUserGesture();

      expect(onChange).toHaveBeenCalled();
      expect(needsGesture).toBe(true);
    });

    test("次の操作の中で再生し直すこと", async () => {
      streamPlayers.unlockStreamPlayers(context);
      await settle();

      expect(player?.element.play).toHaveBeenCalledTimes(2);
      expect(player?.element.pause).not.toHaveBeenCalled();
      expect(player?.blocked).toBe(false);
    });
  });
});

describe("releaseStreamPlayer", () => {
  let streamPlayers: StreamPlayers;
  let player: ReturnType<StreamPlayers["getStreamPlayer"]>;
  let revokeObjectURL: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    streamPlayers = await importStreamPlayers();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:home");
    revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    player = streamPlayers.getStreamPlayer("/home.mp3", new Blob(["home"]));
    if (player) {
      streamPlayers.playStreamPlayer(player);
    }
  });

  test("再生と読み込みを止め、ファイルに作った URL を破棄すること", () => {
    if (player) {
      streamPlayers.releaseStreamPlayer(player);
    }

    expect(player?.element.pause).toHaveBeenCalled();
    expect(player?.element.src).toBe("");
    expect(player?.element.load).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:home");
  });
});

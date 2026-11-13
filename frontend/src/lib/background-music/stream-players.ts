/**
 * iOS Safari は、利用者の操作の中で一度再生した要素でないと、操作の外での再生（画面が移ったときの曲の切り替えなど）を拒む。
 * そのため BGM の `<audio>` 要素は作り捨てず、最初の操作の中で全ての要素を一度再生させておく（`unlockStreamPlayers`）。
 * それでも再生を拒まれた要素は、次の操作の中で再生し直す。
 */

export type StreamPlayer = {
  readonly element: HTMLAudioElement;
  /** MediaElementAudioSourceNode は要素ごとに一度しか作れないので、作ったら使い回す。 */
  source: MediaElementAudioSourceNode | null;
  url: string | null;
  objectUrl: string | null;
  inUse: boolean;
  playing: boolean;
  /** ネットワークからの読み込みが一区切りついたか（続けて再生できるだけ読み込んだか、読み込めなかったか）。 */
  settled: boolean;
  /** 利用者の操作の中で再生を許されたか。`unlocking` は、許されたかの答えを待っている間。 */
  unlock: "locked" | "unlocking" | "unlocked";
  /** 再生を頼んだが、利用者が操作していないために拒まれているか。 */
  blocked: boolean;
};

/** 曲を切り替えるときに、フェードアウトする曲とフェードインする曲を同時に流せるだけ持つ。 */
const STREAM_PLAYER_COUNT = 2;

const players: StreamPlayer[] = [];
let changeListener: (() => void) | null = null;

export function listenForStreamPlayerChanges(onChange: () => void): void {
  changeListener = onChange;
}

function notifyChange() {
  changeListener?.();
}

/**
 * `url` の曲を読み込ませた要素を返す。読み込ませた要素が無ければ、使っていない要素に読み込ませる。
 * `file` を渡すと、ネットワークから読み込まず、そのファイルを読み込ませる。全ての要素を使っていれば `null`。
 * `partial` なら、`file` は取得中のファイルの届いた分なので、終わりまで流したら頭に戻らずに止める。
 */
export function getStreamPlayer(
  url: string,
  file: Blob | null,
  { partial }: { partial: boolean } = { partial: false },
): StreamPlayer | null {
  const loaded = players.find((player) => player.url === url);
  if (loaded) {
    return loaded;
  }
  const player = findFreeStreamPlayer();
  if (!player) {
    return null;
  }
  loadStreamPlayer(player, url, file, partial);
  return player;
}

function findFreeStreamPlayer(): StreamPlayer | null {
  const free = players.find((player) => !player.inUse && player.url === null);
  if (free) {
    return free;
  }
  if (players.length < STREAM_PLAYER_COUNT) {
    return createStreamPlayer();
  }
  const idle = players.find((player) => !player.inUse);
  if (idle) {
    releaseStreamPlayer(idle);
  }
  return idle ?? null;
}

function createStreamPlayer(): StreamPlayer {
  const element = new Audio();
  const player: StreamPlayer = {
    element,
    source: null,
    url: null,
    objectUrl: null,
    inUse: false,
    playing: false,
    settled: false,
    unlock: "locked",
    blocked: false,
  };
  element.preload = "none";
  element.addEventListener("playing", function markPlaying() {
    player.playing = true;
    notifyChange();
  });
  element.addEventListener("pause", function markPaused() {
    player.playing = false;
  });
  element.addEventListener("canplaythrough", function markSettled() {
    settleStreamPlayer(player);
  });
  element.addEventListener("error", function markFailed() {
    if (player.url === null) {
      return;
    }
    if (import.meta.env.DEV) {
      console.warn(`BGM を再生できない: ${player.url}`, element.error);
    }
    settleStreamPlayer(player);
  });
  players.push(player);
  return player;
}

function settleStreamPlayer(player: StreamPlayer) {
  if (player.settled || player.url === null) {
    return;
  }
  player.settled = true;
  notifyChange();
}

function loadStreamPlayer(
  player: StreamPlayer,
  url: string,
  file: Blob | null,
  partial: boolean,
) {
  const { element } = player;
  player.url = url;
  player.objectUrl = file ? URL.createObjectURL(file) : null;
  // 読み解いてバッファのループへ渡すまでのつなぎ。読み解けなかったときも、要素のループで流し続ける。
  element.loop = !partial;
  element.preload = "auto";
  element.src = player.objectUrl ?? url;
}

export function isStreamingFromNetwork(url: string): boolean {
  return players.some(
    (player) =>
      player.url === url && player.objectUrl === null && !player.settled,
  );
}

export function connectStreamPlayer(
  player: StreamPlayer,
  context: AudioContext,
): MediaElementAudioSourceNode {
  if (player.source?.context === context) {
    return player.source;
  }
  player.source = context.createMediaElementSource(player.element);
  return player.source;
}

export function playStreamPlayer(player: StreamPlayer): void {
  player.inUse = true;
  player.blocked = false;
  if (player.unlock === "locked") {
    player.unlock = "unlocking";
  }
  player.element.play().then(
    function markUnlocked() {
      player.unlock = "unlocked";
    },
    function handleRejectedPlay(error: unknown) {
      if (isNotAllowedError(error)) {
        player.unlock = "locked";
        player.blocked = player.inUse;
        notifyChange();
        return;
      }
      player.unlock = "unlocked";
      if (!player.inUse || isAbortError(error)) {
        return;
      }
      if (import.meta.env.DEV) {
        console.warn(`BGM を再生できない: ${player.url}`, error);
      }
    },
  );
}

export function releaseStreamPlayer(player: StreamPlayer): void {
  const { element } = player;
  player.inUse = false;
  player.playing = false;
  player.settled = false;
  player.blocked = false;
  player.url = null;
  element.pause();
  element.removeAttribute("src");
  element.load();
  if (player.objectUrl !== null) {
    URL.revokeObjectURL(player.objectUrl);
    player.objectUrl = null;
  }
}

export function releaseIdleStreamPlayers(keep: (url: string) => boolean): void {
  for (const player of players) {
    if (!player.inUse && player.url !== null && !keep(player.url)) {
      releaseStreamPlayer(player);
    }
  }
}

export function streamPlayersNeedUserGesture(): boolean {
  return (
    players.length < STREAM_PLAYER_COUNT ||
    players.some((player) => player.unlock !== "unlocked" || player.blocked)
  );
}

/** 利用者の操作の中で呼ぶ。 */
export function unlockStreamPlayers(context: AudioContext): void {
  while (players.length < STREAM_PLAYER_COUNT) {
    createStreamPlayer();
  }
  for (const player of players) {
    // 要素の音は先に `context` へ通しておき、外へは出さない。
    connectStreamPlayer(player, context);
    if (player.blocked) {
      playStreamPlayer(player);
    } else if (player.unlock === "locked" && !player.inUse) {
      primeStreamPlayer(player);
    }
  }
}

function primeStreamPlayer(player: StreamPlayer) {
  const { element } = player;
  player.unlock = "unlocking";
  const playing = element.play();
  element.pause();
  playing.then(
    function markUnlocked() {
      player.unlock = "unlocked";
      notifyChange();
    },
    function markUnlockedUnlessRefused(error: unknown) {
      player.unlock = isNotAllowedError(error) ? "locked" : "unlocked";
      notifyChange();
    },
  );
}

function isNotAllowedError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotAllowedError";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

type RandomProblemUnavailable = {
  gameId: string;
  gameName: string;
  onPlayAny?: () => void;
} | null;
let notice: RandomProblemUnavailable = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export const randomProblemUnavailable = {
  getSnapshot(): RandomProblemUnavailable {
    return notice;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  show(gameId: string, gameName: string, onPlayAny?: () => void): void {
    notice = { gameId, gameName, onPlayAny };
    notify();
  },
  dismiss(): void {
    notice = null;
    notify();
  },
};

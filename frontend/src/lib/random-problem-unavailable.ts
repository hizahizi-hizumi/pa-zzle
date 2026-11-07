type RandomProblemUnavailable = { gameId: string; gameName: string } | null;
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
  show(gameId: string, gameName: string): void {
    notice = { gameId, gameName };
    notify();
  },
  dismiss(): void {
    notice = null;
    notify();
  },
};

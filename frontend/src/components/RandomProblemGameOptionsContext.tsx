import { createContext, type ReactNode, useContext } from "react";

export type RandomProblemGameOption = { id: string; name: string };

const RandomProblemGameOptionsContext = createContext<
  readonly RandomProblemGameOption[]
>([]);

type RandomProblemGameOptionsProviderProps = {
  games: readonly RandomProblemGameOption[];
  children: ReactNode;
};

export function RandomProblemGameOptionsProvider({
  games,
  children,
}: RandomProblemGameOptionsProviderProps) {
  return (
    <RandomProblemGameOptionsContext.Provider value={games}>
      {children}
    </RandomProblemGameOptionsContext.Provider>
  );
}

export function useRandomProblemGameOptions(): readonly RandomProblemGameOption[] {
  return useContext(RandomProblemGameOptionsContext);
}

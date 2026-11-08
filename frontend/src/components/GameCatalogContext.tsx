import { createContext, type ReactNode, useContext } from "react";

export type GameCatalogOption = {
  id: string;
  name: string;
  pictogramSvg?: string;
};

const GameCatalogContext = createContext<readonly GameCatalogOption[]>([]);

type GameCatalogProviderProps = {
  games: readonly GameCatalogOption[];
  children: ReactNode;
};

export function GameCatalogProvider({
  games,
  children,
}: GameCatalogProviderProps) {
  return (
    <GameCatalogContext.Provider value={games}>
      {children}
    </GameCatalogContext.Provider>
  );
}

export function useGameCatalog(): readonly GameCatalogOption[] {
  return useContext(GameCatalogContext);
}

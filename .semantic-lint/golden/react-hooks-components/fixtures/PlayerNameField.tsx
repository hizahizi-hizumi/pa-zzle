import { useEffect, useState } from "react";

type PlayerNameFieldProps = {
  playerName: string;
  onRename: (name: string) => void;
};

export function PlayerNameField({ playerName, onRename }: PlayerNameFieldProps) {
  const [name, setName] = useState(playerName);

  useEffect(() => {
    setName(playerName);
  }, [playerName]);

  return (
    <input
      aria-label="プレイヤー名"
      value={name}
      onChange={(event) => setName(event.target.value)}
      onBlur={() => onRename(name)}
    />
  );
}

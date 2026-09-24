import {
  Home,
  MoreHorizontal,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PlayMenuProps = {
  onReplay: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

export function PlayMenu({
  onReplay,
  onChangeDifficulty,
  onBackToHome,
}: PlayMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="その他の操作"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onReplay}>
          <RefreshCw />
          リセット
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onChangeDifficulty}>
          <SlidersHorizontal />
          難易度変更
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onBackToHome}>
          <Home />
          ホーム
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

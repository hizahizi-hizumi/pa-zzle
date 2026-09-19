import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type EmptyRecordsProps = {
  gameLabel: string;
  action: ReactNode;
};

export function EmptyRecords({ gameLabel, action }: EmptyRecordsProps) {
  return (
    <div className="py-8 text-center">
      <p className="font-semibold">まだ記録がありません</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {gameLabel}をクリアすると、ここにプレイ結果が残ります。
      </p>
      <div className="mt-4">
        <Button asChild variant="outline" size="sm">
          {action}
        </Button>
      </div>
    </div>
  );
}

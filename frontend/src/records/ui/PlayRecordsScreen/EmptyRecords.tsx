import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

type EmptyRecordsProps = {
  gameLabel: string;
  action: ReactNode;
};

export function EmptyRecords({ gameLabel, action }: EmptyRecordsProps) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>まだ記録がありません</EmptyTitle>
        <EmptyDescription>
          {gameLabel}をクリアすると、ここにプレイ結果が残ります。
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" size="sm">
          {action}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

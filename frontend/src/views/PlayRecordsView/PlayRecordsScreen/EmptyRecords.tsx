import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

type EmptyRecordsProps = {
  action: ReactNode;
};

export function EmptyRecords({ action }: EmptyRecordsProps) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>まだ記録がありません</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" size="sm">
          {action}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

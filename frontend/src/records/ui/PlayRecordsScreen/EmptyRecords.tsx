import { Link } from "react-router";

import { Button } from "@/components/ui/button";

type EmptyRecordsProps = {
  gameLabel: string;
};

export function EmptyRecords({ gameLabel }: EmptyRecordsProps) {
  return (
    <div className="py-8 text-center">
      <p className="font-semibold">まだ記録がありません</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {gameLabel}をクリアすると、ここにプレイ結果が残ります。
      </p>
      <div className="mt-4">
        <Button asChild variant="outline" size="sm">
          <Link to="/">パズルを選ぶ</Link>
        </Button>
      </div>
    </div>
  );
}

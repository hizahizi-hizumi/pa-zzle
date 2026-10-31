import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/router";

/** 難易度選択の画面が無いので、選べない難易度からはホームへ戻す。 */
export function InvalidDifficulty() {
  return (
    <div className="mx-auto max-w-xl">
      <Alert>
        <AlertTitle>この難易度は選べません</AlertTitle>
        <AlertDescription>
          <Button asChild>
            <Link to="/">ホームへ戻る</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}

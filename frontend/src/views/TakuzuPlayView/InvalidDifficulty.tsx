import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/router";

export function InvalidDifficulty() {
  return (
    <div className="mx-auto max-w-xl">
      <Alert>
        <AlertTitle>この難易度は選べません</AlertTitle>
        <AlertDescription>
          <Button asChild>
            <Link to="/puzzles/takuzu">難易度選択へ戻る</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}

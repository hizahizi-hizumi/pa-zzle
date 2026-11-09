import { Pointer } from "lucide-react";

import { Button } from "@/components/ui/button";

type HowToPlayTutorialButtonProps = {
  onOpenTutorial: () => void;
};

/**
 * 遊び方の中からチュートリアルを始める、控えめなボタン。置き場所の幅いっぱいに広げる。
 * 読む内容より目立たせない。
 */
export function HowToPlayTutorialButton({
  onOpenTutorial,
}: HowToPlayTutorialButtonProps) {
  // 格子の項目は幅いっぱいに伸びるので、ボタンの外観を上書きせずに置き場所の幅へ広げられる。
  return (
    <div className="grid">
      <Button
        type="button"
        variant="outline"
        size="touch"
        onClick={onOpenTutorial}
      >
        <Pointer aria-hidden="true" />
        チュートリアルで遊んで覚える
      </Button>
    </div>
  );
}

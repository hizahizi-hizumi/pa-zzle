import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// globals.css の @theme で定義した文字サイズ。tailwind-merge は既定で知らないため、
// 教えないと `text-meta` などを文字色と見なし、後ろの `text-muted-foreground` と競合したとして消してしまう。
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "screen-title",
        "heading",
        "body",
        "supporting",
        "meta",
        "play-context",
        "play-meta",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

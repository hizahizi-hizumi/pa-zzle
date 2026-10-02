import { ArrowRight } from "lucide-react";
import { Children, type ReactNode } from "react";

type HowToPlayTransitionProps = {
  /** 変化する前から順に並べる図。 */
  children: ReactNode;
};

/** 遊び方の図を、操作による変化の順に矢印でつないで並べる。 */
export function HowToPlayTransition({ children }: HowToPlayTransitionProps) {
  const figures = Children.toArray(children);

  return (
    <div className="flex items-center gap-2">
      {Children.map(figures, (figure, index) => (
        <>
          {index > 0 ? (
            <ArrowRight
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : null}
          {figure}
        </>
      ))}
    </div>
  );
}

import { Board404Jigsaw } from "@/views/NotFoundView/MissingPageJigsaw/Board404Jigsaw";
import { ClassicJigsaw } from "@/views/NotFoundView/MissingPageJigsaw/ClassicJigsaw";

export type MissingPageJigsawVariant = "classic" | "board";

type MissingPageJigsawProps = {
  variant: MissingPageJigsawVariant;
};

export function MissingPageJigsaw({ variant }: MissingPageJigsawProps) {
  if (variant === "board") {
    return <Board404Jigsaw />;
  }

  return <ClassicJigsaw />;
}

import { useState } from "react";

const piecePath =
  "M8 8H34C30 12 28 16 28 21C28 29 34 35 42 35C50 35 56 29 56 21C56 16 54 12 50 8H80V34C76 30 72 28 67 28C59 28 53 34 53 42C53 50 59 56 67 56C72 56 76 54 80 50V80H8V54C12 57 16 59 21 59C29 59 35 53 35 45C35 37 29 31 21 31C16 31 12 33 8 36V8Z";

export function MissingPageJigsaw() {
  const [isPlaced, setIsPlaced] = useState(false);

  return (
    <div className="relative h-52 w-72 select-none sm:h-60 sm:w-84">
      <svg
        aria-hidden="true"
        viewBox="0 0 264 88"
        className="absolute inset-x-0 top-0 w-full"
      >
        <g transform="translate(0 0)">
          <path
            d={piecePath}
            className="fill-brand-subtle stroke-brand-strong"
            strokeWidth="1.5"
          />
          <text
            x="44"
            y="60"
            textAnchor="middle"
            className="fill-brand-foreground text-[44px] font-bold"
          >
            4
          </text>
        </g>

        <g transform="translate(88 0)">
          <path
            d={piecePath}
            className="fill-none stroke-border"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        </g>

        <g transform="translate(176 0)">
          <path
            d={piecePath}
            className="fill-brand-subtle stroke-brand-strong"
            strokeWidth="1.5"
          />
          <text
            x="44"
            y="60"
            textAnchor="middle"
            className="fill-brand-foreground text-[44px] font-bold"
          >
            4
          </text>
        </g>
      </svg>

      <button
        type="button"
        aria-label={isPlaced ? "0のピースがはまりました" : "0のピースをはめる"}
        aria-pressed={isPlaced}
        disabled={isPlaced}
        onClick={() => setIsPlaced(true)}
        className={`absolute top-0 left-1/2 w-24 -translate-x-1/2 touch-manipulation transition-transform duration-(--duration-slow) ease-(--ease-enter) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 sm:w-28 ${
          isPlaced
            ? "translate-y-0 rotate-0"
            : "translate-y-28 rotate-6 cursor-pointer hover:rotate-3 active:scale-95 sm:translate-y-32"
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 88 88" className="w-full">
          <path
            d={piecePath}
            className="fill-brand stroke-brand-strong"
            strokeWidth="1.5"
          />
          <text
            x="44"
            y="60"
            textAnchor="middle"
            className="fill-brand-foreground text-[44px] font-bold"
          >
            0
          </text>
        </svg>
      </button>

      <span className="sr-only" aria-live="polite">
        {isPlaced ? "404が完成しました" : ""}
      </span>
    </div>
  );
}

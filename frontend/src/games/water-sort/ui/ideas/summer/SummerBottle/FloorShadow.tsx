import { getSummerWaterColor } from "@/games/water-sort/ui/ideas/summer/summer-palette";

type FloorShadowProps = {
  /** そろった色。そろうと、陽が色水を通って、影がその色に染まる。 */
  completedColorIndex: number | null;
  /** 持ち上げている間も、影は板の上に残す。 */
  lifted: boolean;
};

// 陽は奥（画面の上）の左から差すので、影は手前の右へ伸びる。
const castShape = {
  top: "97%",
  left: "4%",
  width: "92%",
  height: "24%",
  transform: "skewX(-30deg)",
  transformOrigin: "top",
  borderRadius: "40% 40% 50% 50% / 20% 20% 80% 80%",
} as const;

export function FloorShadow({ completedColorIndex, lifted }: FloorShadowProps) {
  const color =
    completedColorIndex === null
      ? null
      : getSummerWaterColor(completedColorIndex);

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 transition-[translate,opacity] duration-(--duration-normal) ease-standard motion-reduce:transition-none"
      style={{
        translate: lifted ? "0 var(--selected-bottle-lift, 0px)" : undefined,
        opacity: lifted ? 0.6 : 1,
      }}
    >
      {/* 板に触れている所の濃い影 */}
      <span
        className="absolute inset-x-[6%] bottom-[-1.6%] h-[4%] rounded-[50%] blur-[1px]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(66,38,14,0.5) 0%, rgba(66,38,14,0.18) 55%, transparent 75%)",
        }}
      />
      <span
        className="absolute blur-[1.5px] transition-opacity duration-500 [--caustic:rgba(255,246,214,0.55)] [--umbra:rgba(84,52,22,0.3)] motion-reduce:transition-none dark:[--caustic:rgba(255,190,120,0.1)] dark:[--umbra:rgba(0,0,0,0.5)]"
        style={{
          ...castShape,
          opacity: color ? 0 : 1,
          background:
            "radial-gradient(ellipse 26% 34% at 50% 34%, var(--caustic), transparent 100%), linear-gradient(to bottom, var(--umbra), transparent 92%)",
        }}
      />
      {color && (
        <span
          className="absolute blur-[1.5px] animate-in fade-in duration-700 motion-reduce:animate-none"
          style={{
            ...castShape,
            background: `radial-gradient(ellipse 30% 36% at 50% 36%, ${color.light}, transparent 100%), linear-gradient(to bottom, ${color.water}b3, ${color.water}00 94%)`,
          }}
        />
      )}
    </span>
  );
}

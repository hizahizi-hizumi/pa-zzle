type BottleProps = {
  selected?: boolean;
  variant?: "default" | "fluid";
};

export function Bottle({ selected = false, variant = "default" }: BottleProps) {
  return (
    <>
      {variant === "fluid" ? (
        <>
          <span
            className={`water-sort-fluid-vessel absolute inset-x-0 bottom-0 top-2 rounded-b-[1.45rem] border-[2px] border-t-0 transition-colors duration-(--duration-normal) ${selected ? "border-slate-500/75" : "border-slate-400/65"}`}
          />
          <span className="water-sort-fluid-rim absolute left-1/2 top-[3px] h-[2px] w-full -translate-x-1/2 rounded-full bg-slate-400/65" />
        </>
      ) : (
        <>
          <span
            className={`absolute inset-x-0 bottom-0 top-2 rounded-b-[1.45rem] border-[3px] border-t-0 shadow-[inset_0_-2px_5px_rgba(15,23,42,0.08),0_5px_12px_rgba(15,23,42,0.06)] transition-[border-color,filter] duration-(--duration-normal) ${selected ? "border-slate-500 drop-shadow-md" : "border-slate-400/55"}`}
          />
          <span className="absolute left-1/2 top-0 h-[3px] w-[calc(100%-2px)] -translate-x-1/2 rounded-full bg-slate-400/55" />
        </>
      )}
    </>
  );
}

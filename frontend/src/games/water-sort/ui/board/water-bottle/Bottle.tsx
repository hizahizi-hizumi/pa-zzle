type BottleProps = {
  selected?: boolean;
};

export function Bottle({ selected = false }: BottleProps) {
  return (
    <>
      <span
        className={`absolute inset-x-0 bottom-0 top-2 rounded-b-[1.45rem] border-[3px] border-t-0 shadow-[inset_0_-2px_5px_rgba(15,23,42,0.08),0_5px_12px_rgba(15,23,42,0.06)] transition-[border-color,filter] duration-150 ${
          selected ? "border-slate-500 drop-shadow-md" : "border-slate-400/55"
        }`}
      />
      <span className="absolute left-1/2 top-0 h-[3px] w-[calc(100%-2px)] -translate-x-1/2 rounded-full bg-slate-400/55" />
    </>
  );
}

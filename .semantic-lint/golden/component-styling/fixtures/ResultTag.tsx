type ResultTagProps = {
  label: string;
  tone: "bg-emerald-100 text-emerald-900" | "bg-rose-100 text-rose-900";
};

export function ResultTag({ label, tone }: ResultTagProps) {
  return <span className={`rounded px-2 py-0.5 ${tone}`}>{label}</span>;
}

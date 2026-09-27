type DiagnosticRowProps = {
  label: string;
  value: string;
  mono?: boolean;
  breakAll?: boolean;
};

export function DiagnosticRow({
  label,
  value,
  mono = false,
  breakAll = false,
}: DiagnosticRowProps) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`${mono ? "font-mono tabular-nums" : "font-medium"} ${breakAll ? "break-all" : ""} text-right text-foreground`}
      >
        {value}
      </dd>
    </div>
  );
}

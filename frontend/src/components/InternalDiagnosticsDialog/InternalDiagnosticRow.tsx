export type InternalDiagnosticItem = {
  label: string;
  value: string;
  mono?: boolean;
  breakAll?: boolean;
};

type InternalDiagnosticRowProps = InternalDiagnosticItem;

export function InternalDiagnosticRow({
  label,
  value,
  mono = false,
  breakAll = false,
}: InternalDiagnosticRowProps) {
  return (
    <div className="grid grid-cols-[minmax(5rem,max-content)_minmax(0,1fr)] gap-3 py-3 text-supporting">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`${mono ? "font-mono tabular-nums" : "font-medium"} ${breakAll ? "break-all" : ""} text-right text-foreground`}
      >
        {value}
      </dd>
    </div>
  );
}

type DetailMetricProps = {
  label: string;
  value: string;
};

export function DetailMetric({ label, value }: DetailMetricProps) {
  return (
    <div>
      <dt className="text-xs">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}

'use client';

type TProps = {
  label: string;
  value: number;
  tone?: 'danger';
};

export const SummaryTile = ({ label, value, tone }: TProps) => (
  <div className="border p-3">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p
      className={`identifier text-2xl font-bold tabular-nums ${
        tone === 'danger' && value > 0 ? 'text-destructive' : ''
      }`}
    >
      {value}
    </p>
  </div>
);

'use client';

type TProps = {
  label: string;
  value: number;
  tone?: 'danger';
};

export const SummaryTile = ({ label, value, tone }: TProps) => (
  <div className="rounded-md border bg-background p-3 shadow-glass-sm">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p
      className={`identifier text-2xl font-heading tabular-nums ${
        tone === 'danger' && value > 0 ? 'text-destructive' : ''
      }`}
    >
      {value}
    </p>
  </div>
);

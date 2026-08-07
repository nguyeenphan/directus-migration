'use client';

type TProps = {
  index: number;
  label: string;
  detail: string;
};

export const ApplyOrderStep = ({ index, label, detail }: TProps) => (
  <li className="flex gap-3">
    <span className="identifier w-4 shrink-0 text-muted-foreground tabular-nums">
      {index}.
    </span>
    <span className="flex-1">{label}</span>
    <span className="identifier text-muted-foreground">{detail}</span>
  </li>
);

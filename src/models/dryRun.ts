export type TDryRunLine = {
  collection: string;
  toCreate: number;
  toUpdate: number;

  violations: string[];
};

export type TDryRunReport = {
  ranAt: string;
  schemaChanges: number;
  lines: TDryRunLine[];
  totalRows: number;
  totalViolations: number;
};

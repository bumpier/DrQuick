'use client';
import { TrendChart, type TrendSeries } from '@/components/admin/TrendChart';
import { gbp, gbpCompact } from '@/lib/money';

// TrendChart for pence: full pounds in the readout and the table, a compact
// form on the axis. A client wrapper because a server page cannot hand the
// chart its formatting functions.
export function MoneyTrend({ series, labels, ariaLabel, height }: {
  series: TrendSeries[];
  labels: string[];
  ariaLabel: string;
  height?: number;
}) {
  return <TrendChart series={series} labels={labels} ariaLabel={ariaLabel} height={height} format={gbp} axisFormat={gbpCompact} gutter={48} />;
}

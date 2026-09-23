export const money = (v: number): string => `£${v.toLocaleString('en-GB')}`;
export const minutesLabel = (m: number): string => `${m}m`;
export const daysLabel = (d: number): string => `${d} days`;
export const percent = (r: number): string => `${Math.round(r * 100)}%`;

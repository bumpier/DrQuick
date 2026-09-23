export const money = (v: number): string => `£${v.toLocaleString('en-GB')}`;
export const minutesLabel = (m: number): string => `${m}m`;
export const daysLabel = (d: number): string => `${d} days`;
export const percent = (r: number): string => `${Math.round(r * 100)}%`;

// A place in the queue reads as an ordinal ("3rd"), never a bare figure.
export const ordinal = (n: number): string => {
  const rest = n % 100;
  const suffix = rest >= 11 && rest <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
};

/* Which product-nav item is lit, and whether the current screen is a
   dashboard or a linear flow. The DOM wiring (mountShell) is retired: the app
   shell derives both from the pathname in components/app/nav.ts. */
export type Area = 'dash' | 'flow';

export function activeNav(screenId: string, sectionOf: Record<string, string> = {}): string {
  return sectionOf[screenId] ?? screenId;
}

export function areaOf(screenId: string, dashScreens: readonly string[]): Area {
  return dashScreens.includes(screenId) ? 'dash' : 'flow';
}

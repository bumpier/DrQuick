/* Authored inline SVG at 1.8px stroke, sized 18px. The system forbids emoji,
   unicode glyphs and icon fonts, so every mark on these surfaces is here. */

const wrap = (body, size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" `
  + `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  warn: '<path d="M12 3.5 21 19H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>',
  video: '<rect x="3" y="6" width="12.5" height="12" rx="2"/><path d="m15.5 11 5.5-3.2v8.4L15.5 13z"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18"/>',
  shield: '<path d="M12 3.5 19 6v6c0 4-3 7-7 8.5C8 19 5 16 5 12V6z"/><path d="m9 12 2 2 4-4"/>',
  arrow: '<path d="M5 12h13"/><path d="m12.5 6.5 6 5.5-6 5.5"/>',
  bell: '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9"/><path d="M10.2 19a2 2 0 0 0 3.6 0"/>',
  pin: '<path d="M12 21s6.5-5.6 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 15.4 12 21 12 21"/><circle cx="12" cy="10.5" r="2.3"/>',
  file: '<path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M13.5 3.5V9H19"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4S18.3 16.4 19.5 20"/>',
};

export const icon = (name, size = 18) => wrap(ICONS[name] ?? ICONS.warn, size);

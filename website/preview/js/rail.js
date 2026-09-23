import { resolveScreen } from './router.js';

const KINDS = new Set(['screen', 'state']);

export function buildRailModel(groups, screenIds) {
  return groups.map((group) => ({
    label: group.label,
    items: group.items.map((item) => {
      if (!KINDS.has(item.kind)) {
        throw new Error(`Unknown rail kind: ${item.kind}`);
      }
      resolveScreen(screenIds, item.id);
      return { ...item };
    }),
  }));
}

export function renderRail(doc, model, router) {
  const nav = doc.createElement('nav');
  nav.className = 'rail';
  nav.setAttribute('aria-label', 'Prototype navigation');

  for (const group of model) {
    const wrap = doc.createElement('div');
    wrap.className = 'rail__group';

    const label = doc.createElement('span');
    label.className = 'rail__label';
    label.textContent = group.label;
    wrap.append(label);

    for (const item of group.items) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'rail__btn';
      btn.dataset.goto = item.id;
      btn.dataset.kind = item.kind;
      btn.textContent = item.label;
      wrap.append(btn);
    }
    nav.append(wrap);
  }

  doc.body.append(nav);

  const sync = (id) => {
    for (const btn of nav.querySelectorAll('.rail__btn')) {
      btn.setAttribute('aria-current', String(btn.dataset.goto === id));
    }
  };
  doc.addEventListener('screenchange', (event) => sync(event.detail.id));
  sync(router.current());
}

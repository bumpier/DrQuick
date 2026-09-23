/* The app shell: which product-nav item is lit, and whether the page is
   currently a dashboard or a linear flow. Kept apart from router.js because
   the router knows about screens, and this knows about the product's shape. */

export function activeNav(screenId, sectionOf = {}) {
  return sectionOf[screenId] ?? screenId;
}

export function areaOf(screenId, dashScreens) {
  return dashScreens.includes(screenId) ? 'dash' : 'flow';
}

export function mountShell(doc, router, { dash = [], sectionOf = {} } = {}) {
  const buttons = [...doc.querySelectorAll('.topnav [data-goto]')];
  const sync = (id) => {
    doc.body.dataset.area = areaOf(id, dash);
    const current = activeNav(id, sectionOf);
    for (const button of buttons) {
      button.setAttribute('aria-current', String(button.dataset.goto === current));
    }
  };
  doc.addEventListener('screenchange', (event) => sync(event.detail.id));
  sync(router.current());
  return { sync };
}

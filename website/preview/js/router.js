export function resolveScreen(screenIds, target) {
  if (!screenIds.includes(target)) {
    throw new Error(`Unknown screen: ${target}`);
  }
  return target;
}

export function initRouter(doc, initial) {
  const sections = [...doc.querySelectorAll('[data-screen]')];
  const ids = sections.map((s) => s.dataset.screen);
  let current = null;
  let painted = false;

  function show(id) {
    const next = resolveScreen(ids, id);
    // The arrival animation belongs to the first paint only.
    if (painted) doc.body.classList.remove('is-first-paint');
    painted = true;
    for (const section of sections) {
      section.classList.toggle('is-active', section.dataset.screen === next);
    }
    current = next;
    doc.defaultView.location.hash = next;
    doc.dispatchEvent(new CustomEvent('screenchange', { detail: { id: next } }));
  }

  doc.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-goto]');
    if (!trigger) return;
    event.preventDefault();
    show(trigger.dataset.goto);
  });

  const fromHash = doc.defaultView.location.hash.slice(1);
  show(ids.includes(fromHash) ? fromHash : (initial ?? ids[0]));

  return { show, current: () => current, ids: () => [...ids] };
}

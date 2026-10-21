import { DEFAULT_ROLE, PATIENT_MODE } from '@/lib/site-mode';

// Rendered inline by the root layout (app/layout.tsx). It lives here so the
// doctor portal's CSP can allow it by its hash (lib/csp.ts): the portal runs no
// other inline script that Next has not nonced.
//
// Resolving the role before paint means the switch never flashes the wrong page;
// without this script neither hiding rule matches and every mode in the DOM
// renders, so a blocked script cannot blank the page. The page opens on
// DEFAULT_ROLE; `?role=` asks for either mode by name, and failing that a hash
// that belongs to one mode (its capture) opens that mode, so the links the other
// pages carry to #join and #gp-join land on the right audience. With one mode
// shipping there is nothing to resolve — the role is pinned, and a stale
// `?role=patient` link cannot ask for a mode that is not in the document.
export const ROLE_SCRIPT = PATIENT_MODE
  ? `(function () {
  var d = document.documentElement;
  d.classList.add('js');
  var role = '${DEFAULT_ROLE}';
  try {
    var q = new URLSearchParams(location.search).get('role');
    var h = location.hash;
    if (q === 'patient' || q === 'gp') role = q;
    else if (h === '#join' || h === '#join2') role = 'patient';
    else if (h === '#gps' || h === '#gp-join') role = 'gp';
  } catch (e) {}
  d.setAttribute('data-role', role);
})();`
  : `(function () {
  var d = document.documentElement;
  d.classList.add('js');
  d.setAttribute('data-role', '${DEFAULT_ROLE}');
})();`;

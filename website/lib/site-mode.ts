// Which audiences the landing page ships, and which one it opens on.
//
// Both audiences are live: the GP page and the patient page ship side by side
// behind the nav's GPs / Patients switch. Setting PATIENT_MODE to `false` holds
// the patient mode out of the document — the switch, the 999 band and the
// patient metadata go with it and the role script pins `data-role="gp"` before
// paint.
export const PATIENT_MODE = true;

// The role the page opens on when the URL does not ask for one. GPs, since
// 2026-10-01 (the user's decision: the GP sign-up is the main page). Patients
// are one tap away on the switch, at `?role=patient`, and at the `#join` hash
// the other pages link to. With PATIENT_MODE off this must be 'gp': there is
// no patient mode to open on.
const MAIN_ROLE: 'patient' | 'gp' = 'gp';
export const DEFAULT_ROLE: 'patient' | 'gp' = PATIENT_MODE ? MAIN_ROLE : 'gp';

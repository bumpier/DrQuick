// Which audiences the landing page ships.
//
// Both audiences are live at launch: the patient page and the GP page ship side
// by side behind the nav's Patients / GPs switch, and the page opens on the
// patient mode unless `?role=gp` (or a `#gps` / `#gp-join` hash) asks for the GP
// one. Setting this to `false` holds the patient mode out of the document again —
// the switch, the 999 band and the patient metadata go with it and the role
// script pins `data-role="gp"` before paint.
export const PATIENT_MODE = true;

// The role the page opens on when the URL does not ask for one.
export const DEFAULT_ROLE: 'patient' | 'gp' = PATIENT_MODE ? 'patient' : 'gp';

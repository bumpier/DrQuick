// Which audiences the landing page ships.
//
// Dr Quick is signing up doctors first, so the page is the GP page: the patient
// mode is not rendered, the nav loses its Patients / GPs switch, and the role
// script pins `data-role="gp"` before paint. Everything the patient mode needs is
// still in the tree — flip this one constant back to `true` and the second mode,
// the switch, the 999 band and the patient metadata all come back.
export const PATIENT_MODE = false;

// The role the page opens on. With one audience there is nothing to resolve.
export const DEFAULT_ROLE: 'patient' | 'gp' = PATIENT_MODE ? 'patient' : 'gp';

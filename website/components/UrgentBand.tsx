// Patient-flow content, patient mode only. The copy and the live tel: link are
// compliance requirements; ported verbatim, icon included.
export function UrgentBand({ section }: { section?: string } = {}) {
  return (
    <aside className="urgent" data-reveal data-section={section}>
      {/* The white bar is drawn by .urgent p in the authored layer. */}
      <div className="wrap pt-0 pb-0">
        <p>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="9" cy="9" r="7.6" stroke="currentColor" strokeWidth="2.1" />
            <path d="M9 5v4.6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
            <circle cx="9" cy="12.7" r="1.2" fill="currentColor" />
          </svg>
          <span>
            Dr Quick is for urgent but non-emergency care. If something is serious or life-threatening,{' '}
            <b><a className="tel" href="tel:999">call 999</a> or go to A&amp;E.</b>
          </span>
        </p>
      </div>
    </aside>
  );
}

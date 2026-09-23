// Shared by both modes. The second of the two 999 links lives here, so the
// page never loses it; the Storyset attribution is a licence requirement while
// any Storyset asset is on the page.
export function Footer() {
  return (
    <footer className="border-t border-rule pt-12 pb-14 text-fine text-ink-2">
      <div className="wrap flex flex-wrap justify-between gap-y-6 gap-x-10">
        <div>
          <p className="warn text-label font-semibold text-ink tracking-[-.01em]">
            Not for emergencies — <a className="tel" href="tel:999">call 999</a> or go to A&amp;E.
          </p>
          <p className="mt-3">© 2026 Dr Quick · CQC-registered clinical service at launch · Available in England at launch</p>
        </div>
        <div>
          <a className="underline underline-offset-2" href="https://storyset.com/doctors" rel="noopener">
            Doctors illustrations by Storyset
          </a>
        </div>
      </div>
    </footer>
  );
}

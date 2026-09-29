import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { Pagination } from '@/components/admin/DataTable';
import { QuerySelect } from '@/components/admin/QuerySelect';
import { ResendEmailButton } from '@/components/admin/SystemControls';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireAdmin } from '@/lib/admin-auth';
import { fmtDateTime } from '@/lib/admin/format';
import { EMAIL_STATUS_LABELS, humanEmailError, templateLabel } from '@/lib/admin/email-errors';
import { EMAIL_STATUSES, emailTemplates, listEmails, parseEmailQuery } from '@/lib/admin/queries/system';
import { flatParams, withQuery } from '@/lib/admin/url';
import { getDb } from '@/lib/db';
import { emailConfigured } from '@/lib/email';

export const metadata: Metadata = { title: 'Emails' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/admin/system/emails';

export default async function EmailsPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;
  const query = flatParams(params);
  const header = (
    <AdminPageHeader
      title="Emails"
      description="Every email the site has tried to send, newest first. A failed or unsent email tied to a sign-up can be sent again; it is rebuilt from the sign-up as it is now."
    />
  );
  const db = await getDb();
  if (!db) return <>{header}<NoDatabase /></>;

  const q = parseEmailQuery(params);
  const [result, templates] = await Promise.all([listEmails(db, q), emailTemplates(db)]);
  const filtered = Boolean(q.status || q.template);

  return (
    <>
      {header}
      {!emailConfigured() && (
        <p role="note" className="mb-4 rounded-xl bg-stone px-5 py-4 text-body text-ink">
          Email isn’t set up on this server yet (RESEND_API_KEY and EMAIL_FROM), so every attempt is logged as not sent. docs/email.md has the steps.
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <QuerySelect label="Result" name="status" value={q.status ?? null} basePath={BASE} query={query} allLabel="All" clear={['page']}
          options={EMAIL_STATUSES.map((s) => ({ value: s, label: EMAIL_STATUS_LABELS[s] }))} />
        <QuerySelect label="Email" name="template" value={q.template ?? null} basePath={BASE} query={query} allLabel="All" clear={['page']}
          options={templates.map((t) => ({ value: t, label: templateLabel(t) }))} />
        {filtered && (
          <Link href={withQuery(BASE, query, { status: null, template: null, page: null })} className="inline-flex h-12 items-center text-fine font-semibold text-primary-ink">
            Clear filters
          </Link>
        )}
      </div>
      <Card className="block px-4 py-3 max-phone:px-2">
        {result.total === 0 ? (
          <EmptyState className="my-2">{filtered ? 'No emails match these filters.' : 'No emails yet. Sign-ups trigger them.'}</EmptyState>
        ) : (
          <Table stack="cols">
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>When</TableHead>
                <TableHead><span className="sr-only">Action</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell data-label="Email" className="whitespace-normal">
                    <span className="font-semibold">{templateLabel(e.template)}</span>
                    <span className="block text-fine text-ink-2">{e.subject}</span>
                  </TableCell>
                  <TableCell data-label="To" className="break-all whitespace-normal">{e.to}</TableCell>
                  <TableCell data-label="Result" className="whitespace-normal">
                    <Badge variant={e.status === 'sent' ? 'success' : e.status === 'failed' ? 'destructive' : 'secondary'}>
                      {EMAIL_STATUS_LABELS[e.status] ?? e.status}
                    </Badge>
                    {e.error && <span className="mt-1 block max-w-[40ch] text-fine text-ink-2">{humanEmailError(e.error)}</span>}
                  </TableCell>
                  <TableCell data-label="When" className="text-ink-2 tabular-nums">{fmtDateTime(e.createdAt)}</TableCell>
                  <TableCell data-label="Action">
                    {e.status !== 'sent' && e.signupId ? <ResendEmailButton logId={e.id} /> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Pagination page={result.page} pages={result.pages} total={result.total} pageSize={q.pageSize}
        basePath={BASE} query={query} noun={['email', 'emails']} />
    </>
  );
}

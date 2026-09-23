'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  CalendarIcon, CircleAlertIcon, HomeIcon, InboxIcon, InfoIcon, PillIcon,
  SettingsIcon, UserIcon, VideoIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Toaster } from '@/components/ui/sonner';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount,
} from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarSeparator, SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SegmentedLink, SegmentedLinkGroup } from '@/components/ui/segmented-link';
import { BarChart } from '@/components/app/BarChart';
import { LineChart } from '@/components/app/LineChart';
import { ChartLegend, DAILY_LEGEND, DEMAND_LEGEND } from '@/components/app/ChartLegend';
import { earningsFor } from '@/lib/earnings';
import { DEMAND_BY_HOUR, GATE_RECORDS, MY_RECORD, type CredentialRecord } from '@/lib/fixtures';
import { CredentialMatrix } from '@/components/app/CredentialMatrix';
import { Ribbon } from '@/components/app/Ribbon';
import { EmptyState } from '@/components/app/EmptyState';
import { StatTile } from '@/components/app/StatTile';
import { PageHeader } from '@/components/app/PageHeader';
import { Facts } from '@/components/app/Facts';
import { StatusBadge } from '@/components/app/StatusBadge';
import { Stepper, type StepStatus } from '@/components/app/Stepper';
import { STATUS_LABELS } from '@/lib/alerts';
import type { CredentialStatus } from '@/lib/fixtures';
import { DASH } from '@/lib/placeholder';
import { Countdown } from '@/components/app/Countdown';

// Three surfaces every component must sit on. The band is a surface, not a theme.
const SURFACES = [
  { id: 'ground', label: 'On ground', panel: 'bg-surface', muted: 'text-ink-2' },
  { id: 'white', label: 'On white', panel: 'bg-white shadow-card', muted: 'text-ink-2' },
  { id: 'band', label: 'On band', panel: 'bg-band text-white band-grid', muted: 'text-band-muted' },
] as const;
type Surface = (typeof SURFACES)[number];

// The seeded fixture series every chart card draws (lib/earnings, lib/fixtures).
const DAILY_SERIES = earningsFor({ seeded: true, session: [] }).dailySeries;
const DEMAND_SETS = [
  { key: 'first', values: DEMAND_BY_HOUR.map((h) => h.waiting) },
  { key: 'second', values: DEMAND_BY_HOUR.map((h) => h.gps) },
];
const DEMAND_LABELS = DEMAND_BY_HOUR.map((h) => h.hour);

// The four records the matrix must tell apart: two expiring, one expired,
// one still in verification, and blank mode with no record at all.
const MATRIX_EXAMPLES: Array<[title: string, record: CredentialRecord, seeded: boolean]> = [
  ['GP-002 — two expiring', MY_RECORD, true],
  ['GP-003 — indemnity expired', GATE_RECORDS['indemnity-expired'], true],
  ['GP-004 — in verification', GATE_RECORDS['verification-pending'], true],
  ['Blank mode', MY_RECORD, false],
];

// preview/js/doctor.js:47-54 — the onboarding steps as the rail named them.
const STEP_LABELS = ['Register', 'Identity', 'Credentials', 'Indemnity', 'Skills', 'Done'] as const;
const stepsAt = (current: number) =>
  STEP_LABELS.map((label, i) => ({
    id: label.toLowerCase(),
    label,
    status: (i < current ? 'done' : i === current ? 'current' : 'todo') as StepStatus,
  }));

// preview/js/doctor.js:284-291 — the profile's account facts, blank and seeded.
const FACTS_BLANK = [
  ['Reference', 'GP-002'], ['Credentials', DASH], ['Consultations', DASH], ['Earned to date', DASH], ['Working in', 'England only'],
] as const;
const FACTS_SEEDED = [
  ['Reference', 'GP-002'], ['Credentials', '7 of 7 verified'], ['Consultations', '40'], ['Earned to date', '£1,560'], ['Working in', 'England only'],
] as const;

function Section({ id, title, note, children }: {
  id: string; title: string; note?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="border-t border-rule py-10">
      <div className="wrap">
        <h2 id={`${id}-title`} className="text-2xl tracking-[-.02em] mb-1">{title}</h2>
        {note && <p className="text-fine text-ink-2 mb-6 max-w-[72ch]">{note}</p>}
        {!note && <div className="mb-6" />}
        {children}
      </div>
    </section>
  );
}

function Surfaces({ render }: { render: (s: Surface) => React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 max-cols:grid-cols-1">
      {SURFACES.map((s) => (
        <div key={s.id} data-surface={s.id} className={cn('rounded-xl p-6 min-w-0', s.panel)}>
          <p className={cn('text-fine mb-4', s.muted)}>{s.label}</p>
          <div className="flex flex-col items-start gap-4 min-w-0">{render(s)}</div>
        </div>
      ))}
    </div>
  );
}

export function Gallery() {
  const [switchOn, setSwitchOn] = React.useState(true);
  // The root layout's .js class holds every [data-reveal] at opacity 0 until
  // something adds .in, and the gallery mounts no Arrival — so release them here.
  React.useEffect(() => {
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('in'));
  }, []);
  return (
    <TooltipProvider>
      <Toaster />
      <header className="wrap pt-14 pb-8">
        <p className="text-fine text-ink-2 mb-2">Development only · not indexed · 404 in production</p>
        <h1 className="text-4xl tracking-[-.03em]">Component gallery</h1>
        <p className="text-lead text-ink-2 mt-3 max-w-[60ch]">
          Every component in <code>components/ui</code>, in every variant and state, on the ground, on white and on the band.
          Hover and keyboard focus are live: press Tab to walk every control and check the 3px outline or the field glow.
        </p>
        <nav aria-label="Sections" className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-fine">
          {['button', 'segmented-link', 'fields', 'select', 'choice', 'checkbox', 'badge', 'card', 'alert', 'tabs', 'table', 'progress', 'countdown', 'charts', 'avatar', 'separator', 'skeleton', 'breadcrumb', 'tooltip', 'overlays', 'dropdown', 'toast', 'credential-matrix', 'sidebar', 'stat-tile', 'status-badge', 'stepper', 'ribbon', 'empty-state', 'page-header', 'facts'].map((id) => (
            <a key={id} href={`#${id}`} className="text-ink-2 hover:text-primary">{id}</a>
          ))}
        </nav>
      </header>

      <Section id="button" title="Button" note="Default is the landing page's .btn at size lg. Secondary is a light slate fill — there is no outline variant. Disabled is the outline grey; aria-busy adds the pending sweep after 350ms (hidden under reduced motion). Ghost and link are ink-coloured: on the band they take text-white / text-primary-lift explicitly, as shown.">
        <Surfaces render={(s) => (
          <>
            <div className="flex flex-wrap gap-3">
              <Button size="lg">Join the waitlist</Button>
              <Button size="lg" variant="secondary">Secondary</Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost" className={s.id === 'band' ? 'text-white hover:bg-white/10' : undefined}>Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link" className={s.id === 'band' ? 'text-primary-lift' : undefined}>Link</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="xs">Extra small</Button>
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Settings"><SettingsIcon strokeWidth={2} /></Button>
              <Button size="icon-sm" variant="secondary" aria-label="Video"><VideoIcon strokeWidth={2} /></Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" disabled>Disabled</Button>
              <Button size="lg" disabled aria-busy="true">Joining…</Button>
              <Button variant="secondary" disabled>Disabled</Button>
              <Button variant="secondary"><CalendarIcon strokeWidth={2} />With icon</Button>
              <Button asChild size="lg"><a href="#button">As a link</a></Button>
            </div>
          </>
        )} />
      </Section>

      <Section id="segmented-link" title="SegmentedLink" note="Real links carrying aria-current — the Patients / GPs switch. Never Tabs or ToggleGroup.">
        <Surfaces render={() => (
          <>
            <SegmentedLinkGroup aria-label="Choose what you are here for">
              <SegmentedLink href="#segmented-link" current>Patients</SegmentedLink>
              <SegmentedLink href="#segmented-link">GPs</SegmentedLink>
            </SegmentedLinkGroup>
            <SegmentedLinkGroup size="sm" aria-label="Period">
              <SegmentedLink size="sm" href="#segmented-link">Today</SegmentedLink>
              <SegmentedLink size="sm" href="#segmented-link" current>This week</SegmentedLink>
              <SegmentedLink size="sm" href="#segmented-link">All</SegmentedLink>
            </SegmentedLinkGroup>
          </>
        )} />
      </Section>

      <Section id="fields" title="Input, Textarea, Label" note="The filled well: no border at rest, a 2px transparent border held so going invalid never moves the caret. Focus turns it white with the primary border and glow; aria-invalid is the error border and, on focus, the error glow.">
        <Surfaces render={(s) => (
          <div className="grid w-full gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`email-${s.id}`} className={s.id === 'band' ? 'text-white' : undefined}>Email address</Label>
              <Input id={`email-${s.id}`} type="email" placeholder="Enter your email" autoComplete="email" />
            </div>
            <Input type="email" defaultValue="name@example.com" aria-label="Filled" />
            <Input type="email" defaultValue="not-an-email" aria-invalid="true" aria-label="Invalid" />
            <Input type="email" defaultValue="disabled@example.com" disabled aria-label="Disabled" />
            <form className="row" onSubmit={(e) => e.preventDefault()}>
              <Input className="flex-1" type="email" placeholder="Enter your email" aria-label="Email address" />
              <Button className="btn" size="lg" type="submit">Join the waitlist</Button>
            </form>
            <div className="grid gap-2">
              <Label htmlFor={`notes-${s.id}`} className={s.id === 'band' ? 'text-white' : undefined}>Anything else the GP should know</Label>
              <Textarea id={`notes-${s.id}`} placeholder="Optional" />
            </div>
          </div>
        )} />
      </Section>

      <Section id="select" title="Select" note="The trigger is the same filled well; the list is a white popover with the tier-3 shadow.">
        <Surfaces render={(s) => (
          <>
            <Select defaultValue="today">
              <SelectTrigger className="w-full" aria-label="Period">
                <SelectValue placeholder="Choose a period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="all" disabled>All time</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger size="sm" aria-label="Small select"><SelectValue placeholder="Small, empty" /></SelectTrigger>
              <SelectContent><SelectItem value="a">Option</SelectItem></SelectContent>
            </Select>
            <Select>
              <SelectTrigger aria-invalid="true" aria-label={`Invalid select ${s.id}`}><SelectValue placeholder="Invalid" /></SelectTrigger>
              <SelectContent><SelectItem value="a">Option</SelectItem></SelectContent>
            </Select>
            <Select disabled>
              <SelectTrigger aria-label="Disabled select"><SelectValue placeholder="Disabled" /></SelectTrigger>
              <SelectContent><SelectItem value="a">Option</SelectItem></SelectContent>
            </Select>
          </>
        )} />
      </Section>

      <Section id="choice" title="RadioGroup and Switch" note="The safety-check questionnaire reads as a checklist and never shows a score; the whole row is the target.">
        <Surfaces render={(s) => (
          <>
            <RadioGroup defaultValue="no" aria-label="Chest pain in the last hour">
              {['no', 'yes', 'unsure'].map((v) => (
                <label key={v} className={cn('flex items-center gap-3 rounded-md px-3 py-3 cursor-pointer', s.id === 'band' ? 'bg-white/10' : 'bg-surface-mid')}>
                  <RadioGroupItem value={v} id={`${s.id}-${v}`} />
                  <span className="text-body font-semibold capitalize">{v}</span>
                </label>
              ))}
              <label className={cn('flex items-center gap-3 rounded-md px-3 py-3', s.id === 'band' ? 'bg-white/10' : 'bg-surface-mid')}>
                <RadioGroupItem value="disabled" disabled id={`${s.id}-disabled`} />
                <span className="text-body font-semibold text-outline">Disabled</span>
              </label>
            </RadioGroup>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-label font-semibold"><Switch checked={switchOn} onCheckedChange={setSwitchOn} /> Online</label>
              <label className="flex items-center gap-2 text-label font-semibold"><Switch defaultChecked={false} /> Off</label>
              <label className="flex items-center gap-2 text-label font-semibold"><Switch size="sm" defaultChecked /> Small</label>
              <label className="flex items-center gap-2 text-label font-semibold text-outline"><Switch disabled defaultChecked /> Disabled</label>
            </div>
          </>
        )} />
      </Section>

      <Section id="checkbox" title="Checkbox" note="The clinical-skills list: a 20px square on white, filled primary when chosen; the whole row is the target.">
        <Surfaces render={(s) => (
          <div className="grid w-full gap-2">
            {([['general', 'General adult medicine', true], ['minor', 'Minor illness', true], ['derm', 'Dermatology', false]] as const).map(([id, label, on]) => (
              <label key={id} className={cn('flex items-center gap-3 rounded-md px-3 py-3 cursor-pointer text-body font-semibold', s.id === 'band' ? 'bg-white/10' : 'bg-surface-mid')}>
                <Checkbox id={`${s.id}-${id}`} defaultChecked={on} /> {label}
              </label>
            ))}
            <label className={cn('flex items-center gap-3 rounded-md px-3 py-3 text-body font-semibold text-outline', s.id === 'band' ? 'bg-white/10' : 'bg-surface-mid')}>
              <Checkbox disabled /> Disabled
            </label>
          </div>
        )} />
      </Section>

      <Section id="badge" title="Badge" note="Status chips: a 15% fill of the semantic colour with 700-weight text in the same colour, full pill. No outline variant.">
        <Surfaces render={() => (
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Pending</Badge>
            <Badge variant="success">Verified</Badge>
            <Badge variant="destructive">Expired</Badge>
            <Badge variant="ghost">Ghost</Badge>
            <Badge variant="link">Link</Badge>
            <Badge><PillIcon strokeWidth={2} />With icon</Badge>
            <Badge asChild><a href="#badge">As a link</a></Badge>
          </div>
        )} />
      </Section>

      <Section id="card" title="Card" note="Borderless, white with the tier-2 shadow, 16px radius. The band variant is the dark payoff fill. Bento tiles are Cards with p-7 / p-tile-lead-pad overrides.">
        <Surfaces render={() => (
          <>
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Next consultation</CardTitle>
                <CardDescription>Matched to the next available GP.</CardDescription>
                <CardAction><Badge variant="success">Ready</Badge></CardAction>
              </CardHeader>
              <CardContent><p>You are third in line. We will notify you when a GP is free.</p></CardContent>
              <CardFooter><Button size="sm">Open</Button><Button size="sm" variant="secondary">Cancel</Button></CardFooter>
            </Card>
            <Card size="sm" className="w-full">
              <CardHeader><CardTitle>Small card</CardTitle><CardDescription>16px spacing.</CardDescription></CardHeader>
              <CardContent><p>Compact content.</p></CardContent>
            </Card>
            <Card variant="band" className="w-full band-grid">
              <CardHeader><CardTitle>Talk by video.</CardTitle><CardDescription>A secure video consultation, with a prescription, fit note or referral afterwards if you need one.</CardDescription></CardHeader>
              <CardFooter><Button size="sm" variant="secondary">The payoff</Button></CardFooter>
            </Card>
            <Card className="w-full block p-7"><h3>Bento tile</h3><p className="text-body text-ink-2 mt-2.5">The landing page shape: a plain block with 28px padding.</p></Card>
          </>
        )} />
      </Section>

      <Section id="alert" title="Alert" note="A borderless slate fill; the semantic colour sits on the text and the icon only.">
        <Surfaces render={() => (
          <>
            <Alert><InfoIcon strokeWidth={2} /><AlertTitle>Prototype data</AlertTitle><AlertDescription>Figures render as an em dash until the platform has run.</AlertDescription></Alert>
            <Alert variant="accent"><CircleAlertIcon strokeWidth={2} /><AlertTitle>Indemnity expires in 12 days</AlertTitle><AlertDescription>Upload the renewal before it lapses.</AlertDescription><AlertAction><Button size="xs" variant="secondary">Upload</Button></AlertAction></Alert>
            <Alert variant="success"><CircleAlertIcon strokeWidth={2} /><AlertTitle>Verified</AlertTitle><AlertDescription>GMC, DBS and right to work are current.</AlertDescription></Alert>
            <Alert variant="destructive"><CircleAlertIcon strokeWidth={2} /><AlertTitle>Payment failed</AlertTitle><AlertDescription>Your card was declined. Nothing has been charged.</AlertDescription></Alert>
          </>
        )} />
      </Section>

      <Section id="tabs" title="Tabs" note="A fill track with a white active pill (the seg grammar) or an underline in primary. Triggers speak in Geist. The line variant is ink-coloured; on the band it takes text-band-muted / text-white explicitly, as shown.">
        <Surfaces render={(s) => (
          <>
            <Tabs defaultValue="today" className="w-full">
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">This week</TabsTrigger>
                <TabsTrigger value="all" disabled>All time</TabsTrigger>
              </TabsList>
              <TabsContent value="today" className={s.muted}>Nothing yet today.</TabsContent>
              <TabsContent value="week" className={s.muted}>Nothing this week.</TabsContent>
            </Tabs>
            <Tabs defaultValue="earnings" className="w-full">
              {/* The line variant is ink-coloured; on the band the triggers take the band colours explicitly. */}
              <TabsList variant="line">
                {['earnings', 'profile'].map((v) => (
                  <TabsTrigger key={v} value={v} className={s.id === 'band' ? 'text-band-muted hover:text-white group-data-[variant=line]/tabs-list:data-active:text-white data-active:after:bg-primary-lift' : undefined}>
                    {v === 'earnings' ? 'Earnings' : 'Profile'}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="earnings" className={s.muted}>Line variant.</TabsContent>
              <TabsContent value="profile" className={s.muted}>Profile.</TabsContent>
            </Tabs>
          </>
        )} />
      </Section>

      <Section id="table" title="Table" note="12px cells on hairlines with a surface-mid hover; headers are label-caps in Geist. The container scrolls sideways, never the page.">
        <Surfaces render={() => (
          <div className="w-full">
            <Table>
              <TableCaption>Consultations this week</TableCaption>
              <TableHeader>
                <TableRow><TableHead>Patient</TableHead><TableHead>Complaint</TableHead><TableHead>Outcome</TableHead><TableHead className="text-right">Fee</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell>—</TableCell><TableCell>—</TableCell><TableCell><Badge variant="secondary">—</Badge></TableCell><TableCell className="text-right tabular-nums">—</TableCell></TableRow>
                <TableRow><TableCell>A. Patient</TableCell><TableCell>Sore throat</TableCell><TableCell><Badge variant="success">Prescribed</Badge></TableCell><TableCell className="text-right tabular-nums">£46</TableCell></TableRow>
                <TableRow data-state="selected"><TableCell>B. Patient</TableCell><TableCell>Rash</TableCell><TableCell><Badge>Referred</Badge></TableCell><TableCell className="text-right tabular-nums">£39</TableCell></TableRow>
              </TableBody>
            </Table>
            <Table stack="cols" className="mt-8">
              <TableCaption>Stacked below 900px — narrow the window to see the rows collapse</TableCaption>
              <TableHeader>
                <TableRow><TableHead>Patient</TableHead><TableHead>Complaint</TableHead><TableHead>Outcome</TableHead><TableHead className="text-right">Fee</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell label="Patient">A. Patient</TableCell><TableCell label="Complaint">Sore throat</TableCell><TableCell label="Outcome"><Badge variant="success">Prescribed</Badge></TableCell><TableCell label="Fee" className="text-right tabular-nums max-cols:text-left">£46</TableCell></TableRow>
                <TableRow><TableCell label="Patient">B. Patient</TableCell><TableCell label="Complaint">Rash</TableCell><TableCell label="Outcome"><Badge>Referred</Badge></TableCell><TableCell label="Fee" className="text-right tabular-nums max-cols:text-left">£39</TableCell></TableRow>
              </TableBody>
            </Table>
          </div>
        )} />
      </Section>

      <Section id="progress" title="Progress" note="The meter: a 6px fill track with a primary bar.">
        <Surfaces render={() => (
          <div className="grid w-full gap-4">
            <Progress value={0} aria-label="Empty" />
            <Progress value={40} aria-label="Forty percent" />
            <Progress value={100} aria-label="Complete" />
          </div>
        )} />
      </Section>

      <Section id="countdown" title="Countdown" note="The offer window: a Progress that drains one second per tick, aria-hidden numerals in the stat face, and one live region that speaks four times — on arrival and at 30, 15 and 5 seconds. Error on the numerals in the last five seconds and nowhere else. Held at 45, 30, 5 and 0.">
        <Surfaces render={(s) => (
          <div className="grid w-full gap-6">
            {[45, 30, 5, 0].map((remaining) => (
              <div key={remaining} className="grid gap-1">
                <p className={cn('text-fine', s.muted)}>Held at {remaining}s</p>
                <Countdown remaining={remaining} total={45} />
              </div>
            ))}
          </div>
        )} />
      </Section>

      <Section id="charts" title="Charts" note="Inline SVG from lib/charts.ts geometry, drawn at the box's measured width so the axis type never shrinks with the viewport. Today's bar and the first series are the one primary mark; earlier bars are the solid outline grey and the second series is ink-2, dashed. Below 560px the line chart draws one series and the legend drops its caption — narrow the window to see it. No product chart sits on the band; the band panel is here so the marks can be checked against it. In blank mode a chart card renders its written empty state and no legend: a legend is a caption for a picture.">
        <div className="grid gap-4">
          {SURFACES.map((s) => (
            <div key={s.id} data-surface={s.id} className={cn('grid gap-6 rounded-xl p-6', s.panel)}>
              <p className={cn('text-fine', s.muted)}>{s.label}</p>
              <div>
                <p className="text-body font-semibold mb-3">Consultations, last 14 days</p>
                <BarChart data={DAILY_SERIES} height={150} format={(v) => `${v} consultations`} ariaLabel="Consultations, last 14 days" />
                <ChartLegend items={DAILY_LEGEND} />
              </div>
              <div>
                <p className="text-body font-semibold mb-3">Demand against cover, by hour</p>
                <LineChart sets={DEMAND_SETS} labels={DEMAND_LABELS} height={150} ariaLabel="Demand against cover, by hour" />
                <ChartLegend items={DEMAND_LEGEND} />
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4 max-cols:grid-cols-1">
            <Card className="w-full">
              <CardHeader><CardTitle>Seeded</CardTitle><CardDescription>The picture and its caption.</CardDescription></CardHeader>
              <CardContent>
                <BarChart data={DAILY_SERIES} height={150} format={(v) => `${v} consultations`} ariaLabel="Consultations, last 14 days" />
                <ChartLegend items={DAILY_LEGEND} />
              </CardContent>
            </Card>
            <Card className="w-full">
              <CardHeader><CardTitle>Blank</CardTitle><CardDescription>No picture, no legend.</CardDescription></CardHeader>
              <CardContent><EmptyState>No consultations yet.</EmptyState></CardContent>
            </Card>
          </div>
        </div>
      </Section>

      <Section id="avatar" title="Avatar" note="Initials on the band fill, no border ring.">
        <Surfaces render={() => (
          <div className="flex flex-wrap items-center gap-4">
            <Avatar size="sm"><AvatarFallback>LA</AvatarFallback></Avatar>
            <Avatar><AvatarFallback>LA</AvatarFallback></Avatar>
            <Avatar size="lg"><AvatarFallback>LA</AvatarFallback><AvatarBadge /></Avatar>
            <AvatarGroup>
              <Avatar><AvatarFallback>AB</AvatarFallback></Avatar>
              <Avatar><AvatarFallback>CD</AvatarFallback></Avatar>
              <AvatarGroupCount>+3</AvatarGroupCount>
            </AvatarGroup>
          </div>
        )} />
      </Section>

      <Section id="separator" title="Separator" note="A hairline in the rule colour.">
        <Surfaces render={() => (
          <div className="w-full">
            <p>Above</p>
            <Separator className="my-3" />
            <div className="flex h-6 items-center gap-3"><span>Left</span><Separator orientation="vertical" /><span>Right</span></div>
          </div>
        )} />
      </Section>

      <Section id="skeleton" title="Skeleton" note="Genuine loading only; the blank data mode renders an em dash, not a skeleton.">
        <Surfaces render={() => (
          <div className="grid w-full gap-2">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="size-10 rounded-full" />
          </div>
        )} />
      </Section>

      <Section id="breadcrumb" title="Breadcrumb">
        <Surfaces render={(s) => (
          <Breadcrumb>
            <BreadcrumbList className={s.id === 'band' ? 'text-band-muted' : undefined}>
              <BreadcrumbItem><BreadcrumbLink href="#breadcrumb">Doctor</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbEllipsis /></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbLink href="#breadcrumb">Earnings</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage className={s.id === 'band' ? 'text-white' : undefined}>This week</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        )} />
      </Section>

      <Section id="tooltip" title="Tooltip" note="A band-coloured label with the tier-3 shadow. The first is held open for screenshots.">
        <Surfaces render={(s) => (
          <div className="flex flex-wrap gap-6 pt-8">
            <Tooltip open={s.id === 'ground'}>
              <TooltipTrigger asChild><Button variant="secondary">Held open</Button></TooltipTrigger>
              <TooltipContent>Confirmed in writing before your first consultation</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild><Button variant="secondary">Hover me</Button></TooltipTrigger>
              <TooltipContent>Shown on hover or focus</TooltipContent>
            </Tooltip>
          </div>
        )} />
      </Section>

      <Section id="overlays" title="Dialog and Sheet" note="The blocking gates and the drawer: a white panel with the tier-3 shadow over an ink scrim, no border, no blur.">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild><Button>Open dialog</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Verification pending</DialogTitle>
                <DialogDescription>We are checking your GMC registration, DBS and right to work. Nothing is matched to you until every check is complete.</DialogDescription>
              </DialogHeader>
              <DialogFooter showCloseButton>
                <Button>Upload documents</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {(['right', 'left', 'bottom'] as const).map((side) => (
            <Sheet key={side}>
              <SheetTrigger asChild><Button variant="secondary">Sheet from {side}</Button></SheetTrigger>
              <SheetContent side={side}>
                <SheetHeader>
                  <SheetTitle>Navigation</SheetTitle>
                  <SheetDescription>The mobile drawer.</SheetDescription>
                </SheetHeader>
                <div className="px-6 grid gap-2">
                  {['Home', 'Consultations', 'Prescriptions', 'Account'].map((l) => (
                    <a key={l} href="#overlays" className="rounded-md px-3 py-2 text-label font-semibold no-underline hover:bg-surface-mid">{l}</a>
                  ))}
                </div>
                <SheetFooter><Button variant="secondary">Sign out</Button></SheetFooter>
              </SheetContent>
            </Sheet>
          ))}
        </div>
      </Section>

      <Section id="dropdown" title="DropdownMenu" note="A white popover with the tier-3 shadow; items highlight on the surface-mid fill.">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="secondary">Row actions</Button></DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Consultation</DropdownMenuLabel>
            <DropdownMenuItem><VideoIcon strokeWidth={2} />Open<DropdownMenuShortcut>⌘O</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuItem><UserIcon strokeWidth={2} />Patient record</DropdownMenuItem>
            <DropdownMenuCheckboxItem checked>Show in history</DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">End consultation</DropdownMenuItem>
            <DropdownMenuItem disabled>Disabled</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      <Section id="toast" title="Toast (sonner)" note="A white card with the tier-3 shadow; the semantic colour sits on the status icon only.">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => toast('Your GP is ready', { description: 'Dr Patel will join the call now.' })}>Toast</Button>
          <Button variant="secondary" onClick={() => toast.success('Documents uploaded')}>Success</Button>
          <Button variant="secondary" onClick={() => toast.error('Could not reach the server', { description: 'Try again in a moment.' })}>Error</Button>
          <Button variant="secondary" onClick={() => toast.loading('Matching you to a GP…')}>Loading</Button>
        </div>
      </Section>

      <Section id="credential-matrix" title="CredentialMatrix" note="Severity by fill, border and position, never a hue: an expired row is band-filled and leads, its badges go white; an expiring row carries a 2px ink border and follows, soonest first; valid rows are plain. Blank mode has no record, so every row reads Not submitted. Stacks below 560px.">
        <div className="grid grid-cols-2 gap-4 max-cols:grid-cols-1">
          {MATRIX_EXAMPLES.map(([title, record, seeded]) => (
            <Card key={title} className="w-full">
              <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
              <CardContent>
                <CredentialMatrix record={record} seeded={seeded} caption={title} stack="phone" />
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="sidebar" title="Sidebar" note="The app shell. SidebarProvider is mounted inside each surface's layout, never the root layout; below the md line the rail becomes a Sheet.">
        <SidebarProvider className="min-h-0 h-[440px] w-full overflow-hidden rounded-xl bg-white shadow-card">
          <Sidebar collapsible="none" className="border-r border-rule">
            <SidebarHeader>
              <span className="font-display text-xl font-bold tracking-[-.04em] px-2 py-1">Dr<span className="text-primary">Quick</span></span>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Patient</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem><SidebarMenuButton isActive><HomeIcon strokeWidth={2} /><span>Home</span></SidebarMenuButton></SidebarMenuItem>
                    <SidebarMenuItem><SidebarMenuButton><CalendarIcon strokeWidth={2} /><span>Consultations</span></SidebarMenuButton><SidebarMenuBadge>—</SidebarMenuBadge></SidebarMenuItem>
                    <SidebarMenuItem><SidebarMenuButton><PillIcon strokeWidth={2} /><span>Prescriptions</span></SidebarMenuButton></SidebarMenuItem>
                    <SidebarMenuItem><SidebarMenuButton><InboxIcon strokeWidth={2} /><span>Messages</span></SidebarMenuButton></SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarSeparator />
              <SidebarGroup>
                <SidebarGroupLabel>Account</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem><SidebarMenuButton><SettingsIcon strokeWidth={2} /><span>Settings</span></SidebarMenuButton></SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
              <div className="flex items-center gap-3 px-2 py-1">
                <Avatar size="sm"><AvatarFallback>LA</AvatarFallback></Avatar>
                <span className="text-fine font-semibold">Prototype</span>
              </div>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="p-6 gap-4 bg-surface">
            <div className="flex items-center gap-3"><SidebarTrigger /><span className="text-fine text-ink-2">SidebarTrigger (ghost icon button)</span></div>
            <h3>Home</h3>
            <p className="text-ink-2">Content area. Consultations, prescriptions and messages render here.</p>
          </SidebarInset>
        </SidebarProvider>
      </Section>

      {/* ---- components/app: the dashboard compositions (Task 9) ---- */}

      <Section id="stat-tile" title="StatTile" note="A figure through shown()/live() and its label. lg is the headline figure at 36px, sm the secondary at 24px, both Geist and tabular; the em dash sits in the same face and size. A tile is not a card — several sit in one. `against` is the business screen's assumption line and renders in both modes.">
        <Surfaces render={(s) => (
          <Card variant={s.id === 'band' ? 'band' : 'default'} className={cn('w-full', s.id === 'band' && 'band-grid')}>
            <CardContent className="grid grid-cols-2 gap-6">
              <StatTile label="Earned today" value="£117" />
              <StatTile label="Earned today" value={DASH} />
              <StatTile size="sm" label="GPs online vs needed" value="2 of 3" />
              <StatTile size="sm" label="Time online today" value={DASH} />
              <StatTile label="Next payout" value="£468" note="Paid Friday 4 September" />
              <StatTile label="Next payout" value={DASH} note="Nothing to pay out yet" />
              <StatTile label="Real CAC" value="£42" against="plan assumed £16 · £26 above plan" />
              <StatTile label="Real CAC" value={DASH} against="plan assumed £16" />
            </CardContent>
          </Card>
        )} />
      </Section>

      <Section id="status-badge" title="StatusBadge" note="The credential ink ramp (decision 23): pending on the fill in ink-2, expiring steps up to ink at 15%, and Verified, Expired and Rejected are the only success and error on the surfaces. Blank mode has no status — a dash named “Not submitted”. On the band every badge is white at 15%: the row is the severity, the badge carries the word.">
        <Surfaces render={(s) => (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS_LABELS) as CredentialStatus[]).map((status) => (
              <StatusBadge key={status} status={status} onBand={s.id === 'band'} />
            ))}
            <StatusBadge status={null} onBand={s.id === 'band'} />
          </div>
        )} />
      </Section>

      <Section id="stepper" title="Stepper" note="Six bars, ink up to and including the current step and fill beyond it, each with its label; below the phone line only the current label shows. Screen readers get the position from aria-current and the words “completed” / “not started”. The onboarding is never on the band.">
        <div className="grid gap-4">
          <div className="rounded-xl bg-surface p-6"><Stepper steps={stepsAt(0)} /></div>
          <Card className="block p-6"><Stepper steps={stepsAt(3)} /></Card>
          <div className="rounded-xl bg-surface p-6"><Stepper steps={stepsAt(5)} /></div>
        </div>
      </Section>

      <Section id="ribbon" title="Ribbon" note="Prototype chrome, deliberately not the product: a note (not a live region) in the label-caps face, sticky above the rail on every dashboard route. Shown static here.">
        <Ribbon className="static rounded-md" />
      </Section>

      <Section id="empty-state" title="EmptyState" note="A sentence, never an illustration or a skeleton: what every list renders until the platform has produced something.">
        <Surfaces render={(s) => (
          <div className="grid w-full gap-3">
            <EmptyState className={s.id === 'band' ? 'border-band-ink-2 text-band-ink-2' : undefined}>No consultations yet.</EmptyState>
            <EmptyState className={s.id === 'band' ? 'border-band-ink-2 text-band-ink-2' : undefined}>No patients in the queue.</EmptyState>
          </div>
        )} />
      </Section>

      <Section id="page-header" title="PageHeader" note="The route's h1 at headline-lg (32px, 24px below the phone line) — never the landing hero's clamp — with an optional lead and actions. The h1 carries data-reveal and is the focus target on arrival where a screen needs one.">
        <div className="grid gap-8">
          <PageHeader title="Today" actions={<Button>Simulate an offer</Button>} />
          <PageHeader title="Indemnity cover" lead="State-backed NHS indemnity does not cover private telehealth. You need separate cover to consult here." />
        </div>
      </Section>

      <Section id="facts" title="Facts" note="Label and value in two columns on hairlines: the profile's account facts here, the offer's three permitted facts on the session. Values arrive through shown()/live(), so the blank list is dashes, not zeros.">
        <div className="grid grid-cols-2 gap-4 max-cols:grid-cols-1">
          <div className="rounded-xl bg-surface p-6"><p className="text-fine text-ink-2 mb-4">Blank</p><Facts items={FACTS_BLANK} /></div>
          <Card className="block p-6"><p className="text-fine text-ink-2 mb-4">Seeded</p><Facts items={FACTS_SEEDED} /></Card>
        </div>
      </Section>

      <footer className="border-t border-rule py-10">
        <div className="wrap text-fine text-ink-2">Dr Quick · component gallery · development only</div>
      </footer>
    </TooltipProvider>
  );
}

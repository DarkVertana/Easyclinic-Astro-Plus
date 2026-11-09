import * as React from 'react';
import { Button } from '@/components/admin/ui/button';
import { Calendar } from '@/components/admin/ui/calendar';
import { ChevronRight, CircleCheck } from 'lucide-react';
import { AppFrame } from './AppFrame';
import { Muted, Notice, StatusBadge } from './common';
import { formatAgo, formatDateTime, plural } from './format';
import type { FrameData, RowData } from './types';

export interface DashboardProps {
  frame: FrameData;
  now: string;
  storeError: string | null;
  stages: Array<{ key: string; label: string; value: number; href: string }>;
  work: Array<{ row: RowData; label: string; href: string }>;
  workCount: number;
  health: Array<{ label: string; value: number; href: string }>;
  updatedDays: string[];
  scheduled: Array<{ slug: string; title: string; at: string; day: string }>;
  feed: Array<{ at: string; by: string; text: string; title: string; slug: string }>;
  jobs: Array<{ id: string; title: string; note: string }>;
}

const SEGMENT: Record<string, string> = { draft: 'bg-muted-foreground/40', review: 'bg-info', scheduled: 'bg-warning', live: 'bg-success' };
const KEY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Sections are separated by type and space, not boxes. */
function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-semibold tracking-tight text-heading">{title}</h2>
        {aside && <div className="text-muted-foreground tabular-nums">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/** Runs of events on one post share one title, so the feed reads as posts and not as repeats. */
function groupFeed(feed: DashboardProps['feed']) {
  const groups: Array<{ slug: string; title: string; events: DashboardProps['feed'] }> = [];
  for (const event of feed) {
    const last = groups[groups.length - 1];
    if (last && last.slug === event.slug) last.events.push(event);
    else groups.push({ slug: event.slug, title: event.title, events: [event] });
  }
  return groups;
}

export function DashboardPage({ frame, now, storeError, stages, work, workCount, health, updatedDays, scheduled, feed, jobs }: DashboardProps) {
  const nowDate = React.useMemo(() => new Date(now), [now]);
  const updated = React.useMemo(() => new Set(updatedDays), [updatedDays]);
  const sched = React.useMemo(() => new Set(scheduled.map((s) => s.day)), [scheduled]);
  return (
    <AppFrame frame={frame} title="Dashboard" actions={<>
      <Button variant="outline" asChild><a href="/admin/generate/">Generate draft</a></Button>
      <Button asChild><a href="/admin/posts/?new=1">New post</a></Button>
    </>}>
      {storeError && <Notice tone="error" className="mb-6">{storeError}</Notice>}
      <div className="mx-auto w-full max-w-7xl">
        <ul aria-label="Posts by stage" className="-mx-3 grid grid-cols-2 gap-y-2 sm:grid-cols-4 sm:gap-x-4">
          {stages.map((s) => (
            <li key={s.key}>
              <a href={s.href} className="block rounded-md px-3 py-2 transition-colors hover:bg-muted">
                <span className="flex items-center gap-1.5 text-muted-foreground"><span className={`size-2 rounded-full ${SEGMENT[s.key]}`} aria-hidden="true" />{s.label}</span>
                <strong className="mt-1 block text-[length:var(--text-2xl)] leading-tight font-semibold tracking-tight text-heading tabular-nums">{s.value.toLocaleString('en-IN')}</strong>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-5 grid gap-8 border-t pt-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-10">
          <div className="grid min-w-0 content-start gap-8">
            <Section title="My work" aside={workCount > 0 ? plural(workCount, 'post') : undefined}>
              {work.length === 0 && (
                <p className="flex items-center gap-2 border-y py-4"><CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" /><span>Nothing needs you. <a className="text-link underline" href="/admin/posts/?tab=drafts">Pick up a draft</a>.</span></p>
              )}
              {work.length > 0 && (
                <ul className="divide-y border-y">
                  {work.map(({ row, label, href }) => (
                    <li key={row.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                      <div className="min-w-0 flex-1 basis-48">
                        <a className="block truncate font-medium text-heading underline-offset-2 hover:underline" href={href} title={row.title}>{row.title}</a>
                        {row.hint && <Muted className="truncate">{row.hint}</Muted>}
                      </div>
                      <StatusBadge label={row.label} tone={row.tone} />
                      <Button variant="outline" size="sm" asChild><a href={href} aria-label={`${label}: ${row.title}`}>{label}</a></Button>
                    </li>
                  ))}
                </ul>
              )}
              {workCount > work.length && <p className="pt-2"><a className="text-link underline" href="/admin/posts/">See all posts</a></p>}
            </Section>
            <Section title="Content health">
              <ul className="grid border-t sm:grid-cols-2 sm:gap-x-8">
                {health.map((h) => (
                  <li key={h.label} className="border-b">
                    {h.value > 0
                      ? <a href={h.href} className="group flex min-h-11 items-center gap-3 py-2 underline-offset-2"><span className="min-w-0 flex-1 group-hover:underline">{h.label}</span><strong className="font-semibold text-heading tabular-nums">{h.value.toLocaleString('en-IN')}</strong><ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></a>
                      : <div className="flex min-h-11 items-center gap-3 py-2 pr-7 text-muted-foreground"><span className="min-w-0 flex-1">{h.label}</span><span className="tabular-nums">0</span></div>}
                  </li>
                ))}
              </ul>
            </Section>
            {jobs.length > 0 && (
              <Section title="AI jobs" aside={<a className="text-link underline" href="/admin/generate/">See all</a>}>
                <ul className="divide-y border-y">{jobs.map((j) => <li key={j.id} className="py-2.5"><a className="block truncate font-medium text-heading hover:underline" href={`/admin/generate/${j.id}/`}>{j.title}</a><Muted>{j.note}</Muted></li>)}</ul>
              </Section>
            )}
          </div>
          <aside aria-label="Schedule and activity" className="grid min-w-0 content-start gap-8 xl:border-l xl:pl-10">
            <Section title="Publishing calendar">
              <div className="-mx-1 flex justify-center xl:justify-start">
                <Calendar
                  mode="single"
                  timeZone="Asia/Kolkata"
                  today={nowDate}
                  defaultMonth={nowDate}
                  weekStartsOn={1}
                  className="p-1"
                  modifiers={{ scheduled: (d) => sched.has(KEY.format(d)), updated: (d) => updated.has(KEY.format(d)) }}
                  modifiersClassNames={{ scheduled: '[&>button]:underline [&>button]:decoration-warning [&>button]:decoration-2 [&>button]:underline-offset-4 font-semibold', updated: '[&>button]:underline [&>button]:decoration-success [&>button]:decoration-2 [&>button]:underline-offset-4' }}
                />
              </div>
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning" aria-hidden="true" />Scheduled</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" aria-hidden="true" />Live post updated</span>
              </p>
              {scheduled.length === 0 ? <Muted className="mt-3 border-t pt-3">Nothing scheduled.</Muted> : (
                <ul className="mt-3 divide-y border-t">
                  {scheduled.slice(0, 4).map((s) => <li key={s.slug} className="py-2"><a className="block truncate font-medium text-heading hover:underline" href={`/admin/posts/view/?slug=${encodeURIComponent(s.slug)}`}>{s.title}</a><Muted>{formatDateTime(s.at)}</Muted></li>)}
                </ul>
              )}
            </Section>
            <Section title="Activity">
              {feed.length === 0 && <Muted>No activity yet. Saves, reviews and publishes appear here.</Muted>}
              <ul className="grid gap-4">
                {groupFeed(feed).map((g, i) => (
                  <li key={i}>
                    <a className="block truncate font-medium text-heading hover:underline" href={`/admin/posts/view/?slug=${encodeURIComponent(g.slug)}`} title={g.title}>{g.title}</a>
                    <ul className="mt-1.5 grid gap-2 border-l pl-3">
                      {g.events.map((e, j) => (
                        <li key={j} className="min-w-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0 break-words">{e.text}</span>
                            <time className="shrink-0 text-muted-foreground tabular-nums" dateTime={e.at} title={formatDateTime(e.at)}>{formatAgo(e.at, nowDate).toLowerCase()}</time>
                          </div>
                          <Muted className="break-words">{e.by === 'engine' ? 'AI drafting' : e.by}</Muted>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </Section>
          </aside>
        </div>
      </div>
    </AppFrame>
  );
}

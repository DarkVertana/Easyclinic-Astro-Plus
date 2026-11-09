import * as React from 'react';
import { CalendarClock, CircleAlert, CircleCheck, CircleDashed, CircleX, Clock, CornerUpLeft, EyeOff, Info, LoaderCircle, Trash2, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/admin/ui/alert';
import { Badge } from '@/components/admin/ui/badge';
import { cn } from '@/components/admin/lib/utils';
import { EMPTY_CELL, formatDateTime, friendlyMessage, pathLabel, plural } from './format';
import type { Check, CompareData, EvidenceData, HistoryEvent } from './types';

const PILL_ICONS = { trash: Trash2, schedul: CalendarClock, review: Clock, changes: CornerUpLeft, failed: CircleX, reject: CircleX, unpublished: EyeOff, publishing: LoaderCircle } as const;
const TONE: Record<string, string> = {
  success: 'border-transparent bg-success-bg text-success',
  info: 'border-transparent bg-info-bg text-info',
  warning: 'border-transparent bg-warning-bg text-warning',
  danger: 'border-transparent bg-danger-bg text-danger',
  neutral: 'border-border bg-card text-muted-foreground',
};

export function StatusBadge({ label, tone }: { label: string; tone: string }) {
  const text = label.toLowerCase();
  const key = (Object.keys(PILL_ICONS) as Array<keyof typeof PILL_ICONS>).find((k) => text.includes(k));
  const Icon = key ? PILL_ICONS[key] : text.startsWith('published') ? CircleCheck : CircleDashed;
  return (
    <Badge variant="outline" title={label} className={cn('max-w-full', TONE[tone] ?? TONE.neutral)}>
      <Icon aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Badge>
  );
}

const ICON: Record<string, React.ComponentType<{ className?: string }>> = { error: CircleAlert, danger: CircleAlert, success: CircleCheck, warning: TriangleAlert, info: Info };
const NOTICE: Record<string, string> = {
  error: 'border-danger/40 bg-danger-bg text-danger *:data-[slot=alert-description]:text-danger',
  success: 'border-success/40 bg-success-bg text-success *:data-[slot=alert-description]:text-success',
  warning: 'border-warning/40 bg-warning-bg text-warning *:data-[slot=alert-description]:text-warning',
  info: 'border-info/40 bg-info-bg text-info *:data-[slot=alert-description]:text-info',
};

/** Persistent banner. Nothing auto-dismisses. */
export function Notice({ tone = 'info', children, live, actions, className }: { tone?: string; children: React.ReactNode; live?: boolean; actions?: React.ReactNode; className?: string }) {
  const Icon = ICON[tone] ?? Info;
  return (
    <Alert role={live ? 'status' : undefined} className={cn(NOTICE[tone] ?? NOTICE.info, className)}>
      <Icon className="size-4" aria-hidden="true" />
      <AlertDescription className="grid gap-2">
        <div className="min-w-0 break-words">{children}</div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </AlertDescription>
    </Alert>
  );
}

export function Muted({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-muted-foreground', className)}>{children}</p>;
}

export function SerpPreview({ slug, title, description }: { slug: string; title: string; description: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="truncate text-muted-foreground">easyclinic.io › {slug}</p>
      <p className="mt-1 text-base break-words text-link">{title || 'Search title'}</p>
      <p className="mt-1 break-words text-muted-foreground">{description || 'Search description'}</p>
    </div>
  );
}

const HISTORY: Record<string, string> = {
  created: 'Created', edited: 'Edited', submitted: 'Submitted for approval', approved: 'Approved', published: 'Published', changes_requested: 'Changes requested',
  rejected: 'Rejected', reopened: 'Reopened', publish_failed: 'Publishing failed', withdrawn: 'Withdrawn from review', scheduled: 'Scheduled', schedule_cancelled: 'Unscheduled',
  schedule_failed: 'Scheduled publish failed', unpublished: 'Unpublished', trashed: 'Moved to trash', restored: 'Restored', renamed: 'Web address changed', discarded: 'Changes discarded',
  restored_revision: 'Earlier version restored', rebased: 'Updated to the current version', deleted: 'Deleted',
};

export function HistoryList({ history }: { history: HistoryEvent[] }) {
  if (!history.length) return <Muted>No history yet.</Muted>;
  return (
    <ol className="grid gap-3">
      {[...history].reverse().map((e, i) => (
        <li key={i}>
          <p className="font-medium text-heading">{HISTORY[e.action] ?? 'Updated'}</p>
          <Muted>{formatDateTime(e.at)}, {e.by === 'engine' ? 'AI drafting' : e.by}</Muted>
          {e.note && <p className="break-words">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}

export function CheckList({ checks, attempted, onGo }: { checks: Check[] | null; attempted?: boolean; onGo?: (path: string) => void }) {
  if (checks === null) return <p className="text-danger">The checks could not run. Treat this post as unchecked and try again.</p>;
  if (!checks.length) return <p className="flex items-center gap-1.5 text-success"><CircleCheck className="size-4" aria-hidden="true" />No problems found by the automatic checks.</p>;
  const errors = checks.filter((c) => c.severity === 'error');
  const warnings = checks.filter((c) => c.severity !== 'error');
  const row = (c: Check, i: number, error: boolean) => {
    const message = friendlyMessage(c.message, c.path);
    const Icon = error ? (attempted ? CircleAlert : CircleDashed) : TriangleAlert;
    return (
      <li key={i} className="flex items-start gap-2 py-1.5">
        <Icon className={cn('mt-0.5 size-4 shrink-0', error && attempted ? 'text-danger' : 'text-muted-foreground')} aria-label={error ? 'Needed' : 'Suggestion'} />
        <div className="min-w-0 break-words">
          {onGo ? <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => onGo(c.path)}>{message}</button> : <p>{message} <span className="text-muted-foreground">({pathLabel(c.path)})</span></p>}
          {c.excerpt && <Muted className="mt-0.5">{c.excerpt}</Muted>}
        </div>
      </li>
    );
  };
  return (
    <div className="grid gap-4">
      <p><strong className="font-semibold text-heading">{errors.length ? `${plural(errors.length, 'thing')} to fix` : 'Ready to submit'}</strong>{warnings.length > 0 && <span className="text-muted-foreground">, {plural(warnings.length, 'suggestion')}</span>}</p>
      {errors.length > 0 && <section><h3 className="font-semibold">Needed to submit</h3><ul>{errors.map((c, i) => row(c, i, true))}</ul></section>}
      {warnings.length > 0 && <section><h3 className="font-semibold">Recommended</h3><ul>{warnings.map((c, i) => row(c, i, false))}</ul></section>}
    </div>
  );
}

export function CompareView({ data }: { data: CompareData }) {
  const added = data.lines.filter((l) => l.kind === 'add').length;
  const removed = data.lines.filter((l) => l.kind === 'del').length;
  if (!data.changed.length && !data.lines.length) return <Muted>No differences between {data.beforeLabel.toLowerCase()} and {data.afterLabel.toLowerCase()}.</Muted>;
  return (
    <div className="grid gap-6">
      {data.changed.length > 0 && (
        <section>
          <h2 className="font-semibold">{plural(data.changed.length, 'field')} changed</h2>
          <div className="mt-2 grid gap-3">
            {data.changed.map((row, i) => (
              <div key={i} className="rounded-md border p-3">
                <p className="font-medium text-heading">{row.label}</p>
                <dl className="mt-1 grid gap-2 sm:grid-cols-2">
                  <div className="min-w-0"><dt className="text-muted-foreground">{data.beforeLabel}</dt><dd className="break-words">{row.from || EMPTY_CELL}</dd></div>
                  <div className="min-w-0"><dt className="text-muted-foreground">{data.afterLabel}</dt><dd className="break-words">{row.to || EMPTY_CELL}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}
      {data.lines.length > 0 && (
        <section>
          <h2 className="font-semibold">Text</h2>
          <Muted className="mb-2">{plural(added, 'line')} added, {plural(removed, 'line')} removed</Muted>
          <div className="rounded-md border">
            {data.lines.map((line, i) => (
              <div key={i} className={cn('flex gap-2 px-3 py-1 break-words', line.kind === 'add' && 'bg-success-bg text-success', line.kind === 'del' && 'bg-danger-bg text-danger', line.kind === 'gap' && 'text-muted-foreground')}>
                <b aria-label={line.kind === 'add' ? 'Added' : line.kind === 'del' ? 'Removed' : undefined} className="w-3 shrink-0">{line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ''}</b>
                <span className="min-w-0 flex-1 whitespace-pre-wrap">{line.text}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Quote({ children }: { children: React.ReactNode }) {
  return <blockquote className="mt-1 border-l-2 pl-2 text-muted-foreground">{children}</blockquote>;
}

export function Evidence({ job }: { job: EvidenceData }) {
  const host = (id: string) => job.sources.find((s) => s.id === id)?.host;
  const safe = (url: string) => /^https?:\/\//i.test(url);
  return (
    <div className="grid gap-6 break-words">
      <section>
        <h2 className="font-semibold">Sources ({job.sources.length})</h2>
        {job.sources.length === 0 && <Muted className="mt-1">No sources read yet.</Muted>}
        <ul className="mt-1 grid gap-1">{job.sources.map((s) => <li key={s.id}><span className="font-medium text-heading">{s.id}</span> {safe(s.url) ? <a className="text-link underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.host}</a> : (s.title || s.host)} <span className="text-muted-foreground">({s.host}, {s.tier})</span></li>)}</ul>
      </section>
      <section>
        <h2 className="font-semibold">Verified claims ({job.claims.length})</h2>
        <Muted>Code found each quote word for word in its source. That does not prove the source is right.</Muted>
        <ul className="mt-2 grid gap-3">{job.claims.map((c) => <li key={c.id}><p>{c.statement}</p><Quote>{c.quote}</Quote><Muted>Source {c.sourceId}{host(c.sourceId) ? `, ${host(c.sourceId)}` : ''}</Muted></li>)}</ul>
      </section>
      <section>
        <h2 className="font-semibold">Rejected claims ({job.rejectedClaims.length})</h2>
        <Muted>The quote was not in the source. Make sure none of these reached the post.</Muted>
        <ul className="mt-2 grid gap-3">{job.rejectedClaims.map((c, i) => <li key={i}><p>{c.statement}</p><Quote>{c.quote}</Quote></li>)}</ul>
      </section>
      {job.checks.length > 0 && (
        <section>
          <h2 className="font-semibold">Automatic checks on the AI draft ({plural(job.checks.length, 'finding')})</h2>
          <Muted>From the last AI run. The checks run again on the current text at submit and approve, so errors still present there block it.</Muted>
          <ul className="mt-2 grid gap-2">{job.checks.map((c, i) => <li key={i}><p><span className={cn('font-medium', c.severity === 'error' && 'text-danger')}>{c.severity === 'error' ? 'Error' : 'Warning'}:</span> {friendlyMessage(c.message, c.path)}</p><Muted>{pathLabel(c.path)}{c.excerpt ? `: ${c.excerpt}` : ''}</Muted></li>)}</ul>
        </section>
      )}
      {job.reviewFindings.length > 0 && (
        <section>
          <h2 className="font-semibold">AI findings ({plural(job.reviewFindings.length, 'finding')})</h2>
          <Muted>From the AI fact checker and editor. It can be wrong in both directions, so an empty list proves nothing.</Muted>
          <ul className="mt-2 grid gap-2">{job.reviewFindings.map((f, i) => <li key={i}><p><span className="font-medium">{f.severity === 'error' ? 'Error' : 'Warning'}:</span> {friendlyMessage(f.message)}</p>{f.excerpt && <Muted>{f.excerpt}</Muted>}</li>)}</ul>
        </section>
      )}
    </div>
  );
}

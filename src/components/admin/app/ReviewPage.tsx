import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/admin/ui/badge';
import { Button } from '@/components/admin/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/admin/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/admin/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/admin/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/admin/ui/tabs';
import { AppFrame } from './AppFrame';
import { useActions } from './actions';
import { CheckList, CompareView, Evidence, HistoryList, Muted, Notice, SerpPreview, StatusBadge } from './common';
import { EMPTY_CELL, formatAgo, formatDateTime, plural } from './format';
import type { Check, CompareData, EvidenceData, FrameData, HistoryEvent, RowData } from './types';

function Section({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <Collapsible defaultOpen={open} className="border-t pt-3">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-left font-semibold">
        {title}<ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export interface ReviewProps {
  frame: FrameData;
  now: string;
  row: RowData | null;
  sub: { id: string; slug: string; kind: string; state: string; createdBy: string; contentHash: string; history: HistoryEvent[]; submittedAt: string };
  title: string;
  h1: string;
  opening: string;
  html: string;
  faq: Array<{ question: string; html: string }>;
  searchTitle: string;
  searchDescription: string;
  fields: Array<{ name: string; shown: string; external: boolean }>;
  links: Array<{ target: string; external: boolean }>;
  checks: Check[] | null;
  compare: CompareData | null;
  canCompare: boolean;
  changesUnknown: boolean;
  mode: 'rendered' | 'changes';
  previewUrl: string | null;
  precision: string;
  job: EvidenceData | null;
}

export function ReviewPage({ frame, now, row, sub, title, h1, opening, html, faq, searchTitle, searchDescription, fields, links, checks, compare, canCompare, changesUnknown, mode, previewUrl, precision, job }: ReviewProps) {
  const api = useActions({ viewedHash: sub.contentHash, precision });
  const can = (a: string) => ((row?.actions ?? []) as string[]).includes(a);
  const canDecide = can('approve') && sub.state === 'pending';
  const errorCount = (checks ?? []).filter((c) => c.severity === 'error').length;
  const blocked = checks === null || errorCount > 0;
  const target = { slug: sub.slug, title, submissionId: sub.id, site: row?.site ?? 'never', actions: row?.actions ?? [] };
  return (
    <AppFrame
      frame={frame}
      title="Review"
      back={{ href: '/admin/approvals/', label: 'Queue' }}
      meta={row && <StatusBadge label={row.label} tone={row.tone} />}
      actions={<>
        {previewUrl && <Button variant="outline" asChild><a href={previewUrl} target="_blank" rel="noopener noreferrer">Open site preview</a></Button>}
        <Button variant="outline" asChild><a href={`/admin/posts/${sub.id}/`}>Open in editor</a></Button>
      </>}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22.5rem]">
        <article className="mx-auto w-full max-w-[45rem] min-w-0">
          {changesUnknown && <Notice tone="error" className="mb-4">The live version could not be read, so this page cannot show what changed. Compare every field on the right.</Notice>}
          {canCompare && (
            <Tabs value={mode} onValueChange={(v) => location.assign(v === 'changes' ? '?show=changes' : '?')} className="mb-4">
              <TabsList><TabsTrigger value="rendered">Read the post</TabsTrigger><TabsTrigger value="changes">Compare with live</TabsTrigger></TabsList>
            </Tabs>
          )}
          {mode === 'changes' && compare ? <CompareView data={compare} /> : (
            <>
              <h2 className="font-[family-name:var(--font-varela-round)] text-[length:var(--text-2xl)] leading-tight font-normal text-heading">{h1 || <span className="text-muted-foreground">No post title</span>}</h2>
              {opening && <p className="mt-3 text-[length:var(--text-body)] leading-[1.7] text-muted-foreground">{opening}</p>}
              <div className="adm-prose mt-5" dangerouslySetInnerHTML={{ __html: html }} />
              {faq.length > 0 && (
                <section className="mt-8 border-t pt-5">
                  <h3 className="font-semibold">FAQs</h3>
                  {faq.map((item, i) => <div key={i} className="adm-prose mt-3"><p className="font-semibold">{item.question}</p><div dangerouslySetInnerHTML={{ __html: item.html }} /></div>)}
                </section>
              )}
            </>
          )}
        </article>
        <aside aria-label="Review" className="grid min-w-0 content-start gap-4">
          <Card className="gap-3 py-4">
            <CardHeader className="px-4"><CardTitle>{canDecide ? 'Your decision' : 'Decision'}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 px-4">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">Submitted by</dt><dd className="break-all">{sub.createdBy}</dd>
                <dt className="text-muted-foreground">Waiting</dt><dd><time dateTime={sub.submittedAt} title={formatDateTime(sub.submittedAt)}>{formatAgo(sub.submittedAt, new Date(now))}</time></dd>
                <dt className="text-muted-foreground">Type</dt><dd>{sub.kind === 'edit' ? 'Update to a live post' : 'New post'}</dd>
                <dt className="text-muted-foreground">Checks</dt><dd className={errorCount > 0 ? 'text-danger' : undefined}>{checks === null ? 'Did not run' : errorCount > 0 ? `${errorCount} to fix` : 'Passing'}</dd>
              </dl>
              {canDecide && blocked && <Notice tone="warning">Publishing is unavailable until the checks pass. Send it back to the editor.</Notice>}
              {canDecide && (
                <div className="grid gap-2">
                  {!blocked && <Button onClick={() => api.open('approve', target)}>Approve and publish</Button>}
                  {!blocked && can('schedule') && <Button variant="outline" onClick={() => api.open('schedule', target)}>Schedule</Button>}
                  <Button variant="outline" onClick={() => api.open('request-changes', target)}>Send back</Button>
                  <Button variant="outline" className="border-destructive/50 text-destructive" onClick={() => api.open('reject', target)}>Reject</Button>
                </div>
              )}
              {!canDecide && sub.state === 'pending' && <Muted>Only approvers can approve, send back or reject a post.</Muted>}
              {can('unschedule') && <Button variant="outline" onClick={() => api.run('unschedule', target)}>Unschedule</Button>}
              {can('publish-now') && <Button onClick={() => api.open('publish-now', target)}>Publish now</Button>}
              {can('withdraw') && <Button variant="outline" onClick={() => api.run('withdraw', target)}>Withdraw</Button>}
              {sub.state !== 'pending' && <Muted>This post is no longer waiting for approval, so there is nothing to decide here.</Muted>}
              {api.error && <Notice tone="error" live>{api.error}</Notice>}
            </CardContent>
          </Card>
          <Card className="gap-3 py-4">
            <CardHeader className="px-4"><CardTitle>In search results</CardTitle></CardHeader>
            <CardContent className="grid gap-2 px-4">
              <SerpPreview slug={sub.slug} title={searchTitle} description={searchDescription} />
              <Muted className="tabular-nums">Title {searchTitle.length} of 60. Description {searchDescription.length} of 155.</Muted>
            </CardContent>
          </Card>
          <Card className="gap-3 py-4">
            <CardContent className="grid gap-3 px-4">
              <Section title="Checks" open={errorCount > 0}><CheckList checks={checks} attempted /></Section>
              <Section title="Every field that will publish" open>
                <dl className="grid gap-2">{fields.map((f, i) => <div key={i} className="min-w-0"><dt className="text-muted-foreground">{f.name}</dt><dd className="break-words">{f.shown || EMPTY_CELL}{f.external && <Badge variant="outline" className="ml-2">External link</Badge>}</dd></div>)}</dl>
              </Section>
              <Section title={`Links in the text (${links.length})`}>
                {links.length === 0 ? <Muted>No links.</Muted> : <ul className="grid gap-1">{links.map((l, i) => <li key={i} className="break-all">{l.target}{l.external && <Badge variant="outline" className="ml-2">External link</Badge>}</li>)}</ul>}
              </Section>
              {job && <Section title="AI evidence"><Evidence job={job} /></Section>}
              <Section title="History"><HistoryList history={sub.history} /></Section>
            </CardContent>
          </Card>
        </aside>
      </div>
      {api.element}
    </AppFrame>
  );
}

export interface QueueProps {
  frame: FrameData;
  now: string;
  storeError: string | null;
  rows: Array<{ id: string; title: string; kind: string; ai: boolean; createdBy: string; submittedAt: string; problems: number | null }>;
}

export function QueuePage({ frame, now, storeError, rows }: QueueProps) {
  const nowDate = new Date(now);
  return (
    <AppFrame frame={frame} title="Review" meta={rows.length > 0 && <span className="tabular-nums">{plural(rows.length, 'post')} waiting, oldest first</span>}>
      {storeError && <Notice tone="error" className="mb-4">{storeError}</Notice>}
      {!storeError && frame.user.role !== 'approver' && rows.length > 0 && <Notice className="mb-4">Only approvers can decide on these posts. You can read them here.</Notice>}
      {!storeError && (
        <Card className="gap-0 overflow-hidden py-0" data-panel="queue">
          {rows.length === 0 ? (
            <div className="grid justify-items-center gap-1 px-4 py-16 text-center"><p className="font-medium text-heading">No posts waiting.</p><Muted>Posts appear here when an editor submits them.</Muted></div>
          ) : (
            <Table className="table-fixed">
              <TableHeader><TableRow><TableHead className="pl-4">Title</TableHead><TableHead className="hidden w-52 lg:table-cell">Type</TableHead><TableHead className="hidden w-56 lg:table-cell">Submitted by</TableHead><TableHead className="hidden w-28 sm:table-cell">Waiting</TableHead><TableHead className="hidden w-28 sm:table-cell">Checks</TableHead><TableHead className="w-24"><span className="sr-only">Action</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-4"><a className="block truncate font-medium text-heading underline-offset-2 hover:underline" title={r.title} href={`/admin/approvals/${r.id}/`}>{r.title}</a></TableCell>
                    <TableCell className="hidden truncate lg:table-cell">{r.kind === 'edit' ? 'Update to a live post' : 'New post'}{r.ai ? ', AI first draft' : ''}</TableCell>
                    <TableCell className="hidden truncate lg:table-cell" title={r.createdBy}>{r.createdBy}</TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell"><time dateTime={r.submittedAt} title={formatDateTime(r.submittedAt)}>{formatAgo(r.submittedAt, nowDate)}</time></TableCell>
                    <TableCell className={`hidden sm:table-cell ${r.problems ? 'text-danger' : 'text-success'}`}>{r.problems === null ? 'Did not run' : r.problems > 0 ? `${r.problems} to fix` : 'Passing'}</TableCell>
                    <TableCell><Button variant="outline" size="sm" asChild><a href={`/admin/approvals/${r.id}/`} aria-label={`Review ${r.title}`}>Review</a></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </AppFrame>
  );
}

/** Generate, job, insights and login: the smaller screens. */
import * as React from 'react';
import { ChevronRight, CircleCheck, CircleDashed, CircleDot, CircleX } from 'lucide-react';
import { Button } from '@/components/admin/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/admin/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/admin/ui/collapsible';
import { Input } from '@/components/admin/ui/input';
import { Label } from '@/components/admin/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/admin/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/admin/ui/table';
import { Textarea } from '@/components/admin/ui/textarea';
import { goWith, send } from './api';
import { AppFrame, Brand } from './AppFrame';
import { Evidence, Muted, Notice } from './common';
import { formatAgo, formatDateTime, formatUsd, plural, STAGE_LABELS } from './format';
import type { EvidenceData, FrameData, Option } from './types';

const stageText = (stage: string) => (stage === 'failed' ? 'Failed' : stage === 'done' ? 'Draft created' : (STAGE_LABELS.find((s) => s.stage === stage)?.label ?? 'Working'));

export interface GenerateProps {
  frame: FrameData;
  now: string;
  ready: boolean;
  storeError: string | null;
  topics: Option[];
  owners: Option[];
  past: Array<{ id: string; idea: string; stage: string; createdAt: string; cost: number }>;
}

export function GeneratePage({ frame, now, ready, storeError, topics, owners, past }: GenerateProps) {
  const [brief, setBrief] = React.useState({ topicIdea: '', audience: '', country: '', topic: '', owner: '' });
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [ideas, setIdeas] = React.useState<Array<{ title: string; whyNow: string; overlapsWith?: string[] }>>([]);
  const [ideaStatus, setIdeaStatus] = React.useState('');
  const [suggesting, setSuggesting] = React.useState(false);
  const nowDate = new Date(now);
  const set = (name: keyof typeof brief, value: string) => setBrief((b) => ({ ...b, [name]: value }));
  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brief.topic || !brief.owner) return setError('Choose a topic and a landing page.');
    setBusy(true);
    setError(null);
    const reply = await send('/admin/api/jobs/new/', brief);
    if (reply.location) location.assign(reply.location);
    else {
      setBusy(false);
      setError(reply.message || 'The job could not start.');
    }
  };
  const suggest = async () => {
    setSuggesting(true);
    setIdeaStatus('Searching the web for topic ideas. This can take a minute.');
    const reply = await send('/admin/api/topics/');
    setSuggesting(false);
    if (!reply.ok) return setIdeaStatus(reply.message || 'Topic ideas could not be fetched. Try again, or write your own brief.');
    const topicsFound = (reply.topics ?? []) as typeof ideas;
    setIdeas(topicsFound);
    setIdeaStatus(topicsFound.length ? `${topicsFound.length} ideas found.` : 'No ideas came back. Try again, or write your own brief.');
  };
  return (
    <AppFrame frame={frame} title="Generate draft">
      {storeError && <Notice tone="error" className="mb-4">{storeError}</Notice>}
      {!ready && <Notice tone="warning" className="mb-4">AI drafting is off. {frame.user.role === 'approver' ? 'Add the Anthropic key to the environment and restart.' : 'Ask an admin to turn it on.'} Writing and approving posts works without it.</Notice>}
      {ready && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <Card className="min-w-0 gap-3 py-4">
            <CardHeader className="px-4"><CardTitle>Brief</CardTitle></CardHeader>
            <CardContent className="px-4">
              <form onSubmit={start} className="grid gap-4">
                <div className="grid gap-1.5"><Label htmlFor="topicIdea">Topic idea</Label><Textarea id="topicIdea" required value={brief.topicIdea} onChange={(e) => set('topicIdea', e.target.value)} /></div>
                <div className="grid gap-1.5"><Label htmlFor="audience">Audience and next step</Label><Textarea id="audience" required value={brief.audience} onChange={(e) => set('audience', e.target.value)} /><Muted>Who it is for and what they should do after reading.</Muted></div>
                <div className="grid gap-1.5"><Label htmlFor="country">Country (optional)</Label><Input id="country" maxLength={2} value={brief.country} onChange={(e) => set('country', e.target.value)} /><Muted>Two-letter code, such as in or ke.</Muted></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid min-w-0 gap-1.5"><Label id="topic-l">Topic</Label><Select value={brief.topic} onValueChange={(v) => set('topic', v)}><SelectTrigger aria-labelledby="topic-l" className="w-full"><SelectValue placeholder="Choose a topic" /></SelectTrigger><SelectContent>{topics.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid min-w-0 gap-1.5"><Label id="owner-l">Landing page</Label><Select value={brief.owner} onValueChange={(v) => set('owner', v)}><SelectTrigger aria-labelledby="owner-l" className="w-full"><SelectValue placeholder="Choose a landing page" /></SelectTrigger><SelectContent className="max-h-72">{owners.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <Muted>AI researches the topic and writes only from quotes it could verify. You approve the outline, and the draft still goes through normal review.</Muted>
                {error && <Notice tone="error" live>{error}</Notice>}
                <Button type="submit" disabled={busy} className="justify-self-start">{busy ? 'Starting…' : 'Start research'}</Button>
              </form>
            </CardContent>
          </Card>
          <Card className="min-w-0 gap-3 py-4">
            <CardHeader className="flex items-center justify-between px-4"><CardTitle>Topic ideas</CardTitle><Button variant="outline" size="sm" disabled={suggesting} onClick={suggest}>Suggest topics</Button></CardHeader>
            <CardContent className="grid gap-3 px-4">
              <Muted>Suggestions come from AI web research, so check them before relying on them.</Muted>
              {ideaStatus && <p role="status">{ideaStatus}</p>}
              <ul className="divide-y">
                {ideas.map((t, i) => (
                  <li key={i} className="grid gap-1 py-3">
                    <p className="font-medium text-heading">{t.title}</p><p>{t.whyNow}</p>
                    {t.overlapsWith?.length ? <Muted>Overlaps with: {t.overlapsWith.join(', ')}</Muted> : null}
                    <Button variant="link" size="sm" className="h-auto justify-self-start p-0" onClick={() => set('topicIdea', t.title)}>Use this topic</Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
      <Card className="gap-0 overflow-hidden py-0" data-panel="jobs">
        <CardHeader className="border-b px-4 py-3 [.border-b]:pb-3"><CardTitle>Past jobs</CardTitle></CardHeader>
        {past.length === 0 && !storeError && <p className="p-4 text-muted-foreground">No jobs yet.{ready ? ' Fill in the brief to start one.' : ''}</p>}
        {past.length > 0 && (
          <Table className="table-fixed">
            <TableHeader><TableRow><TableHead className="pl-4">Topic</TableHead><TableHead className="hidden w-64 sm:table-cell">Stage</TableHead><TableHead className="hidden w-28 md:table-cell">Started</TableHead><TableHead className="w-20 text-right">Cost</TableHead></TableRow></TableHeader>
            <TableBody>{past.map((j) => (
              <TableRow key={j.id}>
                <TableCell className="pl-4"><a className="block truncate font-medium text-heading hover:underline" title={j.idea} href={`/admin/generate/${j.id}/`}>{j.idea}</a></TableCell>
                <TableCell className="hidden truncate sm:table-cell">{stageText(j.stage)}</TableCell>
                <TableCell className="hidden tabular-nums md:table-cell"><time dateTime={j.createdAt} title={formatDateTime(j.createdAt)}>{formatAgo(j.createdAt, nowDate)}</time></TableCell>
                <TableCell className="text-right tabular-nums">{formatUsd(j.cost)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </Card>
    </AppFrame>
  );
}

export interface JobProps {
  frame: FrameData;
  loadError: string | null;
  job: null | {
    id: string; idea: string; audience: string; stage: string; failedStage: string | null; error: string | null; revisions: number; maxRevisions: number; cost: number; submissionId: string | null;
    outline: null | { title: string; headKeyword: string; angle: string; gaps: string[]; sections: Array<{ heading: string; points: string[]; claimCount: number }> };
    evidence: EvidenceData;
  };
  autoRun: boolean;
  retryStop: string | null;
}

export function JobPage({ frame, loadError, job, autoRun, retryStop }: JobProps) {
  const [runStatus, setRunStatus] = React.useState('Paused. Run the next step to continue.');
  const [working, setWorking] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const noteKey = job ? `admin-draft:outline:${job.id}` : '';
  const step = React.useCallback(async (retry?: boolean) => {
    if (!job) return;
    setWorking(true);
    setError(null);
    const label = stageText(job.stage);
    setRunStatus(`Working: ${label}. Keep this tab open.`);
    const reply = await send(`/admin/api/jobs/${job.id}/advance/`, retry ? { retry: '1' } : {});
    if (reply.ok) location.reload(); // The steps come from the server, so the list is always the truth.
    else {
      setWorking(false);
      setRunStatus(reply.sessionEnded ? 'Your session has ended, so the job is paused. Sign in again and reopen this page.' : 'The step did not finish. The job is paused. Run the next step to try again.');
    }
  }, [job]);
  // One step at a time while this page is open.
  React.useEffect(() => {
    if (autoRun) void step();
    try {
      if (noteKey) setNote(localStorage.getItem(noteKey) ?? '');
    } catch {
      /* Nothing stored. */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!job) {
    return (
      <AppFrame frame={frame} title={loadError ? 'Job unavailable' : 'Job not found'} back={{ href: '/admin/generate/', label: 'Generate' }}>
        {loadError ? <Notice tone="error">{loadError}</Notice> : <p><a className="text-link underline" href="/admin/generate/">See past jobs</a> or start a new brief.</p>}
      </AppFrame>
    );
  }
  const failed = job.stage === 'failed';
  const running = !failed && !['awaiting_outline', 'done'].includes(job.stage);
  const position = STAGE_LABELS.findIndex((s) => s.stage === (failed ? job.failedStage : job.stage));
  const approve = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorking(true);
    const reply = await send(`/admin/api/jobs/${job.id}/approve-outline/`, { note });
    if (reply.ok) {
      try {
        localStorage.removeItem(noteKey);
      } catch {
        /* Nothing stored. */
      }
      goWith(location.pathname, 'Outline approved.');
    } else {
      setWorking(false);
      setError(reply.message);
    }
  };
  return (
    <AppFrame frame={frame} title={job.idea} back={{ href: '/admin/generate/', label: 'Generate' }} meta={<span className="whitespace-nowrap tabular-nums">Cost so far {formatUsd(job.cost)}</span>}>
      <div className="grid gap-4 lg:grid-cols-[22.5rem_minmax(0,1fr)]">
        <Card className="min-w-0 content-start gap-3 self-start py-4">
          <CardHeader className="px-4"><CardTitle>Progress</CardTitle></CardHeader>
          <CardContent className="grid gap-3 px-4">
            <Muted className="break-words">For {job.audience}</Muted>
            <ol className="grid gap-2">
              {STAGE_LABELS.map((s, index) => {
                const state = index < position || job.stage === 'done' ? 'done' : index === position ? (failed ? 'failed' : 'current') : 'todo';
                const Icon = { done: CircleCheck, current: CircleDot, failed: CircleX, todo: CircleDashed }[state]!;
                const tone = { done: 'text-success', current: 'text-info', failed: 'text-danger', todo: 'text-muted-foreground' }[state];
                return (
                  <li key={s.stage} className="flex items-start gap-2" aria-current={state === 'current' ? 'step' : undefined}>
                    <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} aria-label={{ done: 'Complete', current: 'Current step', failed: 'Failed', todo: 'Not started' }[state]} />
                    <span className={state === 'current' ? 'font-semibold text-heading' : state === 'todo' ? 'text-muted-foreground' : undefined}>{s.label}{s.stage === 'revise' ? ` (${job.revisions} of ${job.maxRevisions} rounds used)` : ''}</span>
                  </li>
                );
              })}
            </ol>
            {running && (
              <div className="grid gap-2 border-t pt-3">
                <p role="status">{runStatus}</p>
                <Muted>Steps run only while this page is open. Closing the tab pauses the job, and it continues from the same step when you come back.</Muted>
                {!autoRun && <Muted>This job will not run by itself, because an earlier step stopped without finishing or it has used its retries. Each step costs money, so run it only if you mean to.</Muted>}
                {!working && <Button variant="outline" className="justify-self-start" onClick={() => void step()}>Run next step</Button>}
              </div>
            )}
          </CardContent>
        </Card>
        <div className="grid min-w-0 content-start gap-4">
          {error && <Notice tone="error" live>{error}</Notice>}
          {failed && (
            <Notice tone="error" actions={!retryStop && <Button size="sm" variant="outline" disabled={working} onClick={() => void step(true)}>Retry this step</Button>}>
              This step failed: {job.error ?? 'no reason was recorded.'} Nothing was published.{!retryStop && ' Retrying continues from the failed step.'}{retryStop && <p className="mt-1">{retryStop}</p>}
            </Notice>
          )}
          {job.stage === 'awaiting_outline' && job.outline && (
            <Card className="gap-3 py-4">
              <CardHeader className="px-4"><CardTitle>Review the outline</CardTitle></CardHeader>
              <CardContent className="grid gap-4 px-4 break-words">
                <dl className="grid gap-2">
                  <div><dt className="text-muted-foreground">Working title</dt><dd>{job.outline.title}</dd></div>
                  <div><dt className="text-muted-foreground">Main keyword</dt><dd>{job.outline.headKeyword}</dd></div>
                  <div><dt className="text-muted-foreground">Angle</dt><dd>{job.outline.angle}</dd></div>
                </dl>
                {job.outline.gaps.length > 0 && <section><h3 className="font-semibold">What current results miss</h3><ul className="mt-1 list-disc pl-5">{job.outline.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul></section>}
                <section><h3 className="font-semibold">Sections</h3>
                  <ol className="mt-1 divide-y">{job.outline.sections.map((s, i) => <li key={i} className="py-2"><p className="font-medium text-heading">{s.heading}</p><ul className="list-disc pl-5">{s.points.map((p, n) => <li key={n}>{p}</li>)}</ul><Muted>{s.claimCount ? plural(s.claimCount, 'verified claim') : 'No verified claims'}</Muted></li>)}</ol>
                </section>
                <form onSubmit={approve} className="grid gap-2">
                  <Label htmlFor="note">Note for the writer (optional)</Label>
                  <Textarea id="note" value={note} onChange={(e) => { setNote(e.target.value); try { localStorage.setItem(noteKey, e.target.value); } catch { /* The form still works. */ } }} />
                  <Button type="submit" disabled={working} className="justify-self-start">Approve outline</Button>
                </form>
              </CardContent>
            </Card>
          )}
          {job.stage === 'done' && <Notice tone="success" actions={job.submissionId && <Button size="sm" asChild><a href={`/admin/posts/${job.submissionId}/`}>Open the draft</a></Button>}>The draft is ready. AI wrote it, so it still needs a person to read and review it before it can be published.</Notice>}
          <Card className="py-4"><CardContent className="px-4"><Evidence job={job.evidence} /></CardContent></Card>
        </div>
      </div>
    </AppFrame>
  );
}

export interface InsightsProps {
  frame: FrameData;
  notices: Array<{ tone: string; text: string }>;
  windows: string[];
  rows: Array<{ title: string; path: string; demo: string; views: string; viewsChange: string; clicks: string; clicksChange: string; position: string; buttons: string }>;
  hasNumbers: boolean;
  hasSearch: boolean;
  queueCount: number;
  groups: Array<{ kind: string; label: string; items: Array<{ slug: string; title: string; reason: string }> }>;
}

export function InsightsPage({ frame, notices, windows, rows, hasNumbers, hasSearch, queueCount, groups }: InsightsProps) {
  return (
    <AppFrame frame={frame} title="Insights">
      <div className="grid gap-4">
        {notices.map((n, i) => <Notice key={i} tone={n.tone}>{n.text}</Notice>)}
        {hasNumbers && (
          <Card className="gap-0 overflow-hidden py-0" data-panel="insights">
            <CardHeader className="border-b px-4 py-3 [.border-b]:pb-3"><CardTitle>Results per published post</CardTitle></CardHeader>
            <div className="grid gap-1 p-4 text-muted-foreground">{windows.map((w) => <p key={w}>{w}</p>)}<p>Demo requests are credited to the post a visit started on. Change compares with the previous 28 days. A dash means no figure is available.</p></div>
            <Table className="table-fixed">
              <TableHeader><TableRow><TableHead className="pl-4">Post</TableHead><TableHead className="w-20 text-right">Demos</TableHead><TableHead className="hidden w-20 text-right sm:table-cell">Views</TableHead><TableHead className="hidden w-24 text-right lg:table-cell">Views change</TableHead><TableHead className="hidden w-24 text-right md:table-cell">Search clicks</TableHead><TableHead className="hidden w-24 text-right lg:table-cell">Clicks change</TableHead><TableHead className="hidden w-20 text-right lg:table-cell">Position</TableHead><TableHead className="hidden w-24 text-right lg:table-cell">Button clicks</TableHead></TableRow></TableHeader>
              <TableBody>{rows.map((r) => (
                <TableRow key={r.path}>
                  <TableCell className="pl-4"><a className="block truncate text-link underline" title={r.title} href={r.path}>{r.title}</a></TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{r.demo}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{r.views}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{r.viewsChange}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{r.clicks}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{r.clicksChange}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{r.position}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{r.buttons}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </Card>
        )}
        <Card className="gap-3 py-4">
          <CardHeader className="flex items-center justify-between px-4"><CardTitle>Refresh queue</CardTitle><span className="text-muted-foreground tabular-nums">{plural(queueCount, 'post')}</span></CardHeader>
          <CardContent className="grid gap-2 px-4">
            {!hasSearch && <Muted>Click losses are left out until search data is connected.</Muted>}
            {queueCount === 0 && <Muted>Nothing needs refreshing.</Muted>}
            {groups.map((g) => (
              <Collapsible key={g.kind} className="border-t">
                <CollapsibleTrigger className="group flex min-h-11 w-full items-center gap-2 py-2 text-left font-medium">
                  <ChevronRight className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{g.label}</span><span className="text-muted-foreground tabular-nums">{g.items.length}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="divide-y pb-2 pl-6">
                    {g.items.map((item) => <li key={item.slug} className="py-2"><a className="font-medium text-heading underline-offset-2 hover:underline" href={`/admin/posts/view/?slug=${encodeURIComponent(item.slug)}`}>{item.title}</a><Muted className="break-words">{item.reason}</Muted></li>)}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppFrame>
  );
}

export interface LoginProps {
  flash: { message: string; kind: string } | null;
  setupProblem: string | null;
  expired: boolean;
  dev: boolean;
  back: string;
}

export function LoginPage({ flash, setupProblem, expired, dev, back }: LoginProps) {
  const [role, setRole] = React.useState('approver');
  return (
    <main className="flex min-h-dvh flex-col bg-background p-6 sm:p-8">
      <Brand />
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="grid w-full max-w-sm gap-6">
          <div className="grid gap-2">
            <h1 className="text-[length:var(--text-xl)] leading-tight font-semibold tracking-tight text-heading">Sign in to the admin</h1>
            <Muted>For Easy Clinic editors and approvers. Use the Google account your admin added.</Muted>
          </div>
          {flash?.message && <Notice tone="error" live>{flash.message}</Notice>}
          {setupProblem && <Notice tone="error">{setupProblem} Set these, then reload.</Notice>}
          {expired && !flash && <Notice>Sign in to continue. Text you were typing is kept in this browser and offered back when you return.</Notice>}
          <Button asChild variant="outline" className="h-11 w-full text-heading">
            <a href={`/admin/auth/google/?back=${encodeURIComponent(back)}`}>
              {/* Google's mark keeps its own colours under its brand rules, so these are not site tokens. */}
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]">
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
                <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
                <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
                <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
              </svg>
              Sign in with Google
            </a>
          </Button>
          {dev && (
            <details className="border-t pt-4">
              <summary className="cursor-pointer text-muted-foreground">Development sign-in</summary>
            <form method="post" action="/admin/auth/dev/" className="mt-3 grid gap-3">
              <input type="hidden" name="back" value={back} />
              <Muted>Only available in local development.</Muted>
              <div className="grid gap-1.5"><Label htmlFor="dev-email">Email</Label><Input id="dev-email" name="email" type="email" required defaultValue="dev@easyclinic.io" autoComplete="email" /></div>
              <div className="grid gap-1.5">
                <Label id="dev-role-l">Role</Label>
                <input type="hidden" name="role" value={role} />
                <Select value={role} onValueChange={setRole}><SelectTrigger aria-labelledby="dev-role-l" className="w-full" id="dev-role"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="approver">Approver</SelectItem><SelectItem value="editor">Editor</SelectItem></SelectContent></Select>
              </div>
              <Button type="submit" variant="outline" className="w-full">Sign in for development</Button>
            </form>
            </details>
          )}
        </div>
      </div>
    </main>
  );
}

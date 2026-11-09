import { Ellipsis, ExternalLink, Pencil } from 'lucide-react';
import { Button } from '@/components/admin/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/admin/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/admin/ui/dropdown-menu';
import { AppFrame } from './AppFrame';
import { PostMenuItems, useActions } from './actions';
import { CheckList, Notice, SerpPreview, StatusBadge } from './common';
import { EMPTY_CELL } from './format';
import type { Check, FrameData, RowData } from './types';

export interface ReadProps {
  frame: FrameData;
  row: RowData;
  title: string;
  opening: string;
  html: string;
  faq: Array<{ question: string; html: string }>;
  fields: Array<{ name: string; shown: string }>;
  searchTitle: string;
  searchDescription: string;
  checks: Check[] | null;
}

/** A live post with no working copy. Reading only: this page writes nothing, and Edit is the way into the editor. */
export function ReadPage({ frame, row, title, opening, html, faq, fields, searchTitle, searchDescription, checks }: ReadProps) {
  const api = useActions({ home: '/admin/posts/' });
  const can = (a: string) => (row.actions as string[]).includes(a);
  return (
    <AppFrame
      frame={frame}
      title={title}
      back={{ href: '/admin/posts/', label: 'Posts' }}
      meta={<StatusBadge label={row.label} tone={row.tone} />}
      actions={<>
        {can('view-live') && row.liveUrl && <Button variant="outline" asChild><a href={row.liveUrl} target="_blank" rel="noopener"><ExternalLink aria-hidden="true" />View live</a></Button>}
        {can('edit') && <Button asChild><a href={`/admin/posts/view/?slug=${encodeURIComponent(row.slug)}&edit=1`}><Pencil aria-hidden="true" />Edit</a></Button>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More actions"><Ellipsis aria-hidden="true" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52"><PostMenuItems target={row} api={api} liveUrl={row.liveUrl} inEditor /></DropdownMenuContent>
        </DropdownMenu>
      </>}
    >
      {api.error && <Notice tone="error" live className="mb-4">{api.error}</Notice>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22.5rem]">
        <article className="mx-auto w-full max-w-[45rem] min-w-0">
          <h2 className="font-[family-name:var(--font-varela-round)] text-[length:var(--text-2xl)] leading-tight font-normal text-heading">{title}</h2>
          {opening && <p className="mt-3 text-[length:var(--text-body)] leading-[1.7] text-muted-foreground">{opening}</p>}
          <div className="adm-prose mt-5" dangerouslySetInnerHTML={{ __html: html }} />
          {faq.length > 0 && (
            <section className="mt-8 border-t pt-5">
              <h3 className="font-semibold">FAQs</h3>
              {faq.map((item, i) => <div key={i} className="adm-prose mt-3"><p className="font-semibold">{item.question}</p><div dangerouslySetInnerHTML={{ __html: item.html }} /></div>)}
            </section>
          )}
        </article>
        <aside aria-label="Post details" className="grid min-w-0 content-start gap-4">
          <Card className="gap-3 py-4"><CardHeader className="px-4"><CardTitle>In search results</CardTitle></CardHeader><CardContent className="px-4"><SerpPreview slug={row.slug} title={searchTitle} description={searchDescription} /></CardContent></Card>
          <Card className="gap-3 py-4"><CardHeader className="px-4"><CardTitle>Checks</CardTitle></CardHeader><CardContent className="px-4"><CheckList checks={checks} /></CardContent></Card>
          <Card className="gap-3 py-4">
            <CardHeader className="px-4"><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="px-4">
              <dl className="grid gap-2">{fields.map((f, i) => <div key={i} className="min-w-0"><dt className="text-muted-foreground">{f.name}</dt><dd className="break-words">{f.shown || EMPTY_CELL}</dd></div>)}</dl>
            </CardContent>
          </Card>
        </aside>
      </div>
      {api.element}
    </AppFrame>
  );
}

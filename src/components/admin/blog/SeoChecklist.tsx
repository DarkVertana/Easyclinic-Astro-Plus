/** The SEO checklist panel body and its score badge. The checks themselves live in ./seo.ts. */
import { Check, ChevronRight, CircleAlert, CircleX } from 'lucide-react';
import { cn } from '@/components/admin/lib/utils';
import type { SeoReport, SeoState } from './seo';

const tone = (score: number) => (score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger');

export function SeoScore({ score }: { score: number }) {
  const t = tone(score);
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
        t === 'success' && 'bg-success-bg text-success',
        t === 'warning' && 'bg-warning-bg text-warning',
        t === 'danger' && 'bg-danger-bg text-danger',
      )}
      aria-label={`SEO score ${score} out of 100`}
    >
      {score}/100
    </span>
  );
}

function StateIcon({ state }: { state: SeoState }) {
  if (state === 'pass') return <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-label="Done" />;
  if (state === 'warn') return <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-label="Could improve" />;
  return <CircleX className="mt-0.5 size-3.5 shrink-0 text-danger" aria-label="Needs fixing" />;
}

const ORDER: Record<SeoState, number> = { fail: 0, warn: 1, pass: 2 };

export function SeoChecklist({ report, onJump }: { report: SeoReport; onJump: (target: string) => void }) {
  const { score, counts, groups } = report;
  const t = tone(score);
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-[13px] font-medium text-heading">{score >= 80 ? 'Good to go' : score >= 50 ? 'Getting there' : 'Needs work'}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
          <div className={cn('h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none', t === 'success' ? 'bg-success' : t === 'warning' ? 'bg-warning' : 'bg-danger')} style={{ width: `${score}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          {counts.fail > 0 && <><span className="font-medium text-danger">{counts.fail} to fix</span> · </>}
          {counts.warn > 0 && <><span className="font-medium text-warning">{counts.warn} to improve</span> · </>}
          {counts.pass} done
        </p>
      </div>

      <div className="-mx-2 grid gap-1">
        {groups.filter((g) => g.items.length).map((g) => {
          const open = g.items.filter((i) => i.state !== 'pass').length;
          return (
            <details key={g.id} open={open > 0} className="group rounded-md">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-heading hover:bg-muted [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
                <span className="flex-1">{g.title}</span>
                {open ? <span className="text-xs font-normal tabular-nums text-muted-foreground">{open} open</span> : <Check className="size-3.5 text-success" aria-label="All done" />}
              </summary>
              <ul className="mt-0.5 grid gap-0.5 pl-5">
                {[...g.items].sort((a, b) => ORDER[a.state] - ORDER[b.state]).map((i) => (
                  <li key={i.id}>
                    {i.state === 'pass' ? (
                      <p className="flex gap-2 px-2 py-1 text-[13px] leading-snug text-muted-foreground"><StateIcon state={i.state} /><span>{i.text}</span></p>
                    ) : (
                      <button type="button" onClick={() => onJump(i.target)} className="flex w-full gap-2 rounded-md px-2 py-1 text-left text-[13px] leading-snug text-foreground hover:bg-muted">
                        <StateIcon state={i.state} /><span>{i.text}</span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}

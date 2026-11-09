import { requireUser } from '../../../../../lib/admin/auth.ts';
import { advanceJob, approveOutline, retryJob, toPublicError } from '../../../../../lib/admin/engine.ts';
import { assertSameOrigin, formText, guarded, PublicError, readForm, redirectFlash, wantsJson } from '../../../../../lib/admin/http.ts';
import type { Job } from '../../../../../lib/admin/types.ts';

export const prerender = false;

/** Source text is large and untrusted; the client needs the state, not the pages. */
const summary = (job: Job) => ({
  id: job.id,
  stage: job.stage,
  error: job.error ?? null,
  revisions: job.revisions,
  submissionId: job.submissionId,
  usage: job.usage,
  updatedAt: job.updatedAt,
});

export const POST = guarded((context) => `/admin/generate/${context.params.id}/`, async (context) => {
  assertSameOrigin(context.request, context.url);
  const user = await requireUser(context);
  const id = context.params.id ?? '';
  const form = await readForm(context.request);
  try {
    let job: Job;
    switch (context.params.action) {
      case 'advance':
        if (formText(form, 'retry')) await retryJob(id);
        job = await advanceJob(id);
        break;
      case 'approve-outline':
        job = await approveOutline(id, user, formText(form, 'note'));
        break;
      case 'retry':
        job = await retryJob(id);
        break;
      default:
        throw new PublicError('Unknown action.', 404);
    }
    if (wantsJson(context.request)) return Response.json({ ok: true, job: summary(job) });
    return redirectFlash(`/admin/generate/${job.id}/`, job.error ?? 'Step finished.', job.error ? 'error' : 'success');
  } catch (error) {
    throw toPublicError(error);
  }
});

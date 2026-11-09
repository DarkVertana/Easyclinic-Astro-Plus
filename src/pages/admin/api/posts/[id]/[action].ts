import { requireApprover, requireUser } from '../../../../../lib/admin/auth.ts';
import { PublicError, assertSameOrigin, formText, guarded, readForm, redirectFlash, wantsJson } from '../../../../../lib/admin/http.ts';
import { getStore } from '../../../../../lib/admin/store.ts';
import type { Submission } from '../../../../../lib/admin/types.ts';
import { approve, contentFromForm, discard, duplicatePost, publishNow, rebase, reject, reopen, requestChanges, restoreRevision, saveEdit, schedule, submitForApproval, unschedule, withdraw } from '../../../../../lib/admin/workflow.ts';

export const prerender = false;

const ID = /^[A-Za-z0-9-]{1,100}$/;
const postPage = (id: unknown) => (typeof id === 'string' && ID.test(id) ? `/admin/posts/${id}/` : '/admin/');

// A refused review action returns to the review screen, where the approver can see why.
const reviewPage = (id: unknown) => (typeof id === 'string' && ID.test(id) ? `/admin/approvals/${id}/` : '/admin/approvals/');
const REVIEW_ACTIONS = ['approve', 'schedule', 'unschedule', 'publish-now', 'request-changes', 'reject'];

export const POST = guarded((context) => (REVIEW_ACTIONS.includes(context.params.action ?? '') ? reviewPage(context.params.id) : postPage(context.params.id)), async (context) => {
  assertSameOrigin(context.request, context.url);
  const { id, action } = context.params;
  if (!id || !ID.test(id)) throw new PublicError('That post is not in the admin.', 404);
  // Role before anything is read from the body.
  const user = REVIEW_ACTIONS.includes(action ?? '') ? await requireApprover(context) : await requireUser(context);
  const form = await readForm(context.request);
  const answers = () => ({ viewedHash: formText(form, 'viewedHash'), onlyUsCouldWrite: formText(form, 'onlyUsCouldWrite'), readsMachineWritten: formText(form, 'readsMachineWritten') });
  let result: Submission;
  let message: string;
  let page = postPage(id);
  switch (action) {
    case 'save': {
      const current = await getStore().getSubmission(id);
      if (!current) throw new PublicError('That post is not in the admin.', 404);
      const expected = formText(form, 'expectedUpdatedAt');
      result = await saveEdit(id, contentFromForm(form, current.content), user, expected);
      message = result.updatedAt === current.updatedAt ? 'No changes' : 'Saved.';
      break;
    }
    case 'submit':
      result = await submitForApproval(id, user);
      message = 'Submitted for approval.';
      break;
    case 'withdraw':
      result = await withdraw(id, user);
      message = 'Withdrawn from review.';
      break;
    case 'discard':
      result = await discard(id, user);
      message = 'Changes discarded. The version in Git is untouched.';
      page = '/admin/posts/';
      break;
    case 'duplicate': {
      const source = await getStore().getSubmission(id);
      if (!source) throw new PublicError('That post is not in the admin.', 404);
      result = await duplicatePost(source.slug, user);
      message = 'Duplicated as a new draft.';
      page = postPage(result.id);
      break;
    }
    case 'approve':
      result = await approve(id, user, answers());
      message = 'Approved and published.';
      break;
    case 'schedule':
      result = await schedule(id, user, { ...answers(), at: formText(form, 'at') });
      message = 'Approved and scheduled.';
      break;
    case 'unschedule':
      result = await unschedule(id, user);
      message = 'Unscheduled. It is back in review.';
      break;
    case 'publish-now':
      result = await publishNow(id, user);
      message = 'Published.';
      break;
    case 'request-changes':
      result = await requestChanges(id, user, formText(form, 'note'));
      message = 'Sent back with your note.';
      break;
    case 'reject':
      result = await reject(id, user, formText(form, 'note'));
      message = 'Rejected.';
      break;
    case 'reopen':
      result = await reopen(id, user);
      message = 'Reopened as a draft.';
      break;
    case 'restore-revision':
      result = await restoreRevision(id, formText(form, 'revision'), user);
      message = 'That version is back in the working copy. Nothing changed on the live site.';
      break;
    case 'rebase':
      result = await rebase(id, form.getAll('useMain').filter((v): v is string => typeof v === 'string'), user);
      message = 'Updated to the current version with your choices.';
      break;
    default:
      throw new PublicError('Unknown action.', 404);
  }
  if (wantsJson(context.request)) return Response.json({ ok: true, message, id: result.id, state: result.state, updatedAt: result.updatedAt, contentHash: result.contentHash });
  return redirectFlash(page, message, 'success');
});

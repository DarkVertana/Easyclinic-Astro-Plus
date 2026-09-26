/**
 * Progressive enhancement for the demo form. Without JS the form posts to /demo/submit/ and gets a
 * 303 to the confirmation page. With JS: a real start time for the spam trap, inline field errors, and
 * a disabled button while sending.
 */
for (const form of document.querySelectorAll<HTMLFormElement>('form[data-demo-form]')) {
  const started = form.querySelector<HTMLInputElement>('input[name="startedAt"]');
  if (started) started.value = String(Date.now());
  const summary = form.querySelector<HTMLElement>('[data-form-status]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  const showErrors = (errors: Record<string, string>) => {
    for (const el of form.querySelectorAll<HTMLElement>('[data-error-for]')) {
      const message = errors[el.dataset.errorFor!];
      el.textContent = message ?? '';
      el.hidden = !message;
      const field = form.querySelector<HTMLElement>(`[name="${el.dataset.errorFor}"]`);
      field?.setAttribute('aria-invalid', message ? 'true' : 'false');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    button?.setAttribute('disabled', '');
    if (summary) summary.textContent = 'Sending your request…';
    try {
      const response = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { accept: 'application/json' } });
      const result = await response.json();
      if (result.ok) {
        location.assign(result.redirect);
        return;
      }
      if (result.errors) {
        showErrors(result.errors);
        if (summary) summary.textContent = 'Please check the highlighted fields.';
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      } else if (summary) {
        summary.textContent = result.message;
      }
    } catch {
      // Network failure: fall back to a normal form post.
      form.submit();
      return;
    }
    button?.removeAttribute('disabled');
  });
}

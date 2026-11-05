/**
 * Search for the /blog/ index (postIndex block). Progressive enhancement: every entry is in the HTML and
 * the topic chips filter with CSS alone; this shows the search field, hides rows that do not match as
 * people type, updates each topic's count, and writes the result into the status line, which is announced.
 */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
const noun = (n: number) => (n === 1 ? 'guide' : 'guides');

for (const root of document.querySelectorAll<HTMLElement>('[data-post-index]')) {
  const field = root.querySelector<HTMLElement>('[data-pi-search]');
  const input = root.querySelector<HTMLInputElement>('[data-pi-input]');
  const status = root.querySelector<HTMLElement>('[data-pi-status]');
  if (!field || !input || !status) continue;
  const clear = root.querySelector<HTMLButtonElement>('[data-pi-clear]')!;
  const empty = root.querySelector<HTMLElement>('[data-pi-empty]')!;
  const emptyText = root.querySelector<HTMLElement>('[data-pi-empty-text]')!;
  const emptyHint = root.querySelector<HTMLElement>('[data-pi-empty-hint]')!;
  const emptyAction = root.querySelector<HTMLButtonElement>('[data-pi-clear-all]')!;
  const radios = Array.from(root.querySelectorAll<HTMLInputElement>('input[data-topic-input]'));
  // A row matches on its title, summary and topic name, so "billing" finds every billing post.
  const groups = Array.from(root.querySelectorAll<HTMLElement>('[data-pi-group]')).map((el) => {
    const topicName = el.querySelector('h2, h3')?.textContent ?? '';
    return {
      el,
      topic: el.dataset.topic!,
      rows: Array.from(el.querySelectorAll<HTMLElement>('[data-pi-row]')).map((row) => ({ row, text: fold(`${row.textContent} ${topicName}`) })),
    };
  });
  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  root.dataset.enhanced = '';
  field.hidden = false;

  let announce = 0;
  const update = (immediate = false) => {
    const query = input.value.trim();
    const terms = fold(query).split(/\s+/).filter(Boolean);
    const chosen = radios.find((r) => r.checked);
    const topic = chosen && chosen.value !== 'all' ? chosen.value : null;
    const topicLabel = chosen?.dataset.label;

    const counts: Record<string, number> = {};
    let all = 0;
    for (const g of groups) {
      let n = 0;
      for (const { row, text } of g.rows) {
        const match = terms.every((t) => text.includes(t));
        row.hidden = !match;
        if (match) n++;
      }
      g.el.hidden = n === 0;
      const count = g.el.querySelector('[data-pi-group-count]');
      const groupNoun = g.el.querySelector('[data-pi-group-noun]');
      if (count) count.textContent = String(n);
      if (groupNoun) groupNoun.textContent = noun(n);
      counts[g.topic] = n;
      all += n;
    }
    counts.all = all;
    for (const el of root.querySelectorAll<HTMLElement>('[data-pi-count]')) {
      const n = counts[el.dataset.piCount!] ?? 0;
      el.textContent = String(n);
      el.parentElement?.toggleAttribute('data-empty', n === 0);
    }

    const shown = topic ? counts[topic] : all;
    const scope = topic ? ` in ${topicLabel}` : '';
    let sentence: string;
    if (!terms.length) sentence = topic ? `Showing ${shown} ${noun(shown)}${scope}` : `Showing all ${total} ${noun(total)}`;
    else sentence = `${shown} ${noun(shown)}${scope} ${shown === 1 ? 'matches' : 'match'} “${query}”`;

    clear.hidden = query === '';
    empty.hidden = shown > 0;
    // While the empty message shows, the status line says the same thing, so only screen readers get it.
    status.classList.toggle('sr-only', shown === 0);
    if (shown === 0) {
      // The next step depends on why nothing shows: matches elsewhere, or no match at all.
      const elsewhere = Boolean(topic) && all > 0;
      emptyText.textContent = terms.length ? `No guides${scope} match “${query}”` : `No guides${scope} yet`;
      emptyHint.textContent = elsewhere
        ? `${all} ${all === 1 ? 'guide matches' : 'guides match'} in other topics.`
        : 'Check the spelling, or try one word, such as a country or a module.';
      emptyAction.textContent = elsewhere ? `Show ${all === 1 ? 'the match' : `all ${all} matches`}` : 'Clear the search';
      emptyAction.toggleAttribute('data-keep-query', elsewhere);
    }

    // Announce once typing pauses, not on every key.
    window.clearTimeout(announce);
    if (immediate) status.textContent = sentence;
    else announce = window.setTimeout(() => (status.textContent = sentence), 350);
  };

  input.addEventListener('input', () => update());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) {
      input.value = '';
      update();
    }
  });
  for (const r of radios) r.addEventListener('change', () => update(true));
  clear.addEventListener('click', () => {
    input.value = '';
    update();
    input.focus();
  });
  emptyAction.addEventListener('click', () => {
    if (!emptyAction.hasAttribute('data-keep-query')) input.value = '';
    const allTopics = radios.find((r) => r.value === 'all');
    if (allTopics) allTopics.checked = true;
    update();
    input.focus();
  });

  // A topic tile above the list also chooses that topic in the filter; the link then scrolls to it as usual.
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-pi-topic-link]')) {
    link.addEventListener('click', () => {
      const radio = radios.find((r) => r.value === link.dataset.piTopicLink);
      if (!radio) return;
      radio.checked = true;
      update(true);
    });
  }

  // A search or topic the browser restored (back button) applies straight away.
  update(true);
}

/**
 * Header menus are native <details> elements (keyboard and screen-reader support built in, and every
 * link is in the HTML without JS). This adds: one menu open at a time, Escape to close and return
 * focus, and closing on an outside click.
 */
const menus = Array.from(document.querySelectorAll<HTMLDetailsElement>('details[data-menu]'));

function closeAll(except?: HTMLDetailsElement) {
  for (const menu of menus) if (menu !== except && menu.open) menu.open = false;
}

for (const menu of menus) {
  menu.addEventListener('toggle', () => {
    if (menu.open && menu.dataset.menu === 'dropdown') closeAll(menu);
    if (menu.dataset.menu === 'drawer') document.documentElement.classList.toggle('drawer-open', menu.open);
  });
}

/*
 * A dropdown closes shortly after the pointer leaves it (the label and its panel). The delay lets the pointer cross
 * the gap between the two, and coming back cancels it. Mouse only: touch has no hover to leave.
 */
for (const menu of menus.filter((m) => m.dataset.menu === 'dropdown')) {
  let timer: number | undefined;
  menu.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse' || !menu.open) return;
    timer = window.setTimeout(() => (menu.open = false), 250);
  });
  menu.addEventListener('pointerenter', () => window.clearTimeout(timer));
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const open = menus.find((m) => m.open);
  if (!open) return;
  open.open = false;
  open.querySelector('summary')?.focus();
});

document.addEventListener('click', (event) => {
  const target = event.target as Node;
  for (const menu of menus) {
    if (menu.open && menu.dataset.menu === 'dropdown' && !menu.contains(target)) menu.open = false;
  }
});

/*
 * Shrinks the header once the page has scrolled. Two thresholds (on past 40px, off above 8px) stop it flickering when
 * the shrinking header itself nudges the scroll position.
 */
const header = document.querySelector<HTMLElement>('[data-header]');
if (header) {
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    if (y > 40) header.dataset.scrolled = '';
    else if (y < 8) delete header.dataset.scrolled;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

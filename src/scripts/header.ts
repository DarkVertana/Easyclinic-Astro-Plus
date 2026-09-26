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

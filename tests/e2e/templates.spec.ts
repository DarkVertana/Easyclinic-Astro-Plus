import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { builtPages } from './pages';

for (const page of builtPages()) {
  test.describe(page.path, () => {
    test('has one h1, no console errors and no horizontal overflow', async ({ page: p }) => {
      const errors: string[] = [];
      p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(page.path);
      await expect(p.locator('h1')).toHaveCount(1);
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(0);
      expect(errors.filter((e) => !/googletagmanager|favicon/.test(e))).toEqual([]);
    });

    test('passes axe (WCAG 2.2 AA)', async ({ page: p }) => {
      await p.goto(page.path);
      const results = await new AxeBuilder({ page: p })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        // The preview toolbar and placeholder highlights are not part of the published page.
        .exclude('.preview-toolbar')
        .analyze();
      const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      expect(summary).toEqual([]);
    });
  });
}

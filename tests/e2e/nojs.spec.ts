import { expect, test } from '@playwright/test';
import { builtPages } from './pages';

// Nothing hidden behind JavaScript (spec 7.1, section 11 UX 9).
for (const page of builtPages()) {
  test(`${page.path} works without JavaScript`, async ({ page: p }) => {
    await p.goto(page.path);
    await expect(p.locator('h1')).toHaveCount(1);
    const faq = p.locator('details[data-faq]');
    if (await faq.count()) {
      await faq.first().locator('summary').click();
      await expect(faq.first()).toHaveAttribute('open', '');
    }
  });
}

test('pricing shows prices without JavaScript', async ({ page }) => {
  const pricing = builtPages().find((p) => p.path === '/pricing/');
  test.skip(!pricing, 'pricing page not built');
  await page.goto('/pricing/');
  await expect(page.getByText(/per doctor per month/i).first()).toBeVisible();
});

test('the demo form submits without JavaScript', async ({ page }) => {
  const contact = builtPages().find((p) => p.path === '/contact-us/');
  test.skip(!contact, 'contact page not built');
  await page.goto('/contact-us/');
  const form = page.locator('form[data-demo-form]');
  await form.getByLabel('Your name').fill('Test Doctor');
  await form.getByLabel('Phone number without the country code').fill('91477 70277');
  await form.getByLabel('Email').fill('test@example.com');
  await form.getByLabel('Clinic name').fill('Test Clinic');
  await form.getByText('Solo practice', { exact: true }).click();
  await form.getByText('1', { exact: true }).click();
  await form.getByLabel('Country', { exact: true }).selectOption('India');
  await expect(form.getByRole('button', { name: /book my 20-minute demo/i })).toBeVisible();
  // Implicit submission (Enter in a text field): the preview toolbar can cover the button in preview builds.
  await form.getByLabel('Clinic name').press('Enter');
  await expect(page).toHaveURL(/\/demo\/confirmation\//);
  await expect(page.locator('h1')).toHaveText(/We have your demo request/);
});

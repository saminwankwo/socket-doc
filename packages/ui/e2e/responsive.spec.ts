import { test, expect } from '@playwright/test';

const sizes = [
  { w: 360, h: 740 },
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1024, h: 768 },
  { w: 1280, h: 800 },
  { w: 1920, h: 1080 },
];

for (const { w, h } of sizes) {
  for (const tab of ['Documentation', 'Playground']) {
    test(`${tab} @ ${w}px: no horizontal scroll, footer visible`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('http://localhost:3000/socket-docs/');
      if (w < 1024) await page.getByRole('button', { name: /menu/i }).click();
      // Scoped to the sidebar: the header breadcrumb shows the same tab name
      await page.locator('aside').getByText(tab, { exact: true }).click();
      // Let the drawer close (200ms transform) before measuring/capturing
      await page.waitForTimeout(350);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page.getByRole('link', { name: 'GitHub' })).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `e2e/shots/${tab}-${w}.png`,
        fullPage: true,
      });
    });
  }
}

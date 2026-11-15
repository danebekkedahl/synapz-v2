import { expect, test } from '@playwright/test';

const LIVE_URL = 'https://danebekkedahl.github.io/synapz-v2/';

const LIVE_DEVICES = [
  { label: 'Desktop 1920x1080', width: 1920, height: 1080 },
  { label: 'Tablet 1024x768', width: 1024, height: 768 },
  { label: 'Phone 412x915', width: 412, height: 915 },
];

test.describe('SYNAPZ V2 — Live GitHub Pages Verification', () => {
  for (const device of LIVE_DEVICES) {
    test(`Live Pages ${device.label} — 0 404s, 0 errors & synapz_v2_* storage isolation`, async ({
      page,
    }) => {
      const notFoundUrls: string[] = [];
      const runtimeErrors: string[] = [];

      page.on('response', (res) => {
        if (res.status() === 404) {
          notFoundUrls.push(res.url());
        }
      });
      page.on('pageerror', (err) => runtimeErrors.push(err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') runtimeErrors.push(msg.text());
      });

      await page.setViewportSize({ width: device.width, height: device.height });
      const response = await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      expect(response?.status()).toBe(200);

      await expect(page.getByTestId('drop-puck-start-btn')).toBeVisible();
      await page.getByTestId('drop-puck-start-btn').click();
      await expect(page.getByTestId('live-read-canvas')).toBeVisible();

      const storageAudit = await page.evaluate(() => {
        const lsKeys = Object.keys(window.localStorage);
        const ssKeys = Object.keys(window.sessionStorage);
        return {
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
          lsKeys,
          nonPrefixedLs: lsKeys.filter((k) => !k.startsWith('synapz_v2_')),
          nonPrefixedSs: ssKeys.filter((k) => !k.startsWith('synapz_v2_')),
        };
      });

      expect(storageAudit.scrollW).toBeLessThanOrEqual(storageAudit.clientW);
      expect(storageAudit.lsKeys.length).toBeGreaterThan(0);
      expect(storageAudit.nonPrefixedLs).toEqual([]);
      expect(storageAudit.nonPrefixedSs).toEqual([]);
      expect(notFoundUrls).toEqual([]);
      expect(runtimeErrors).toEqual([]);
    });
  }
});

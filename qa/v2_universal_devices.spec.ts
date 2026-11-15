import { expect, Page, test } from '@playwright/test';

const SCREENSHOT_DIR = 'qa/screenshots_v2_universal';

async function assertZeroOverflowAndStorageIsolation(page: Page, label: string) {
  const check = await page.evaluate(() => {
    const lsKeys = Object.keys(window.localStorage);
    const ssKeys = Object.keys(window.sessionStorage);
    const invalidLs = lsKeys.filter((k) => !k.startsWith('synapz_v2_'));
    const invalidSs = ssKeys.filter((k) => !k.startsWith('synapz_v2_'));
    return {
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      scrollH: document.documentElement.scrollHeight,
      clientH: document.documentElement.clientHeight,
      scrollY: window.scrollY,
      lsKeys,
      invalidLs,
      invalidSs,
    };
  });

  expect(check.scrollW, `${label}: horizontal overflow`).toBeLessThanOrEqual(check.clientW);
  expect(check.scrollH, `${label}: vertical overflow`).toBeLessThanOrEqual(check.clientH);
  expect(check.scrollY, `${label}: accidental window scrollY`).toBe(0);
  expect(check.lsKeys.length, `${label}: expected synapz_v2_* keys`).toBeGreaterThan(0);
  expect(check.invalidLs, `${label}: non-prefixed localStorage keys`).toEqual([]);
  expect(check.invalidSs, `${label}: non-prefixed sessionStorage keys`).toEqual([]);
}

function attachErrorCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`CONSOLE_ERROR: ${msg.text()}`);
  });
  return errors;
}

test.describe('SYNAPZ V2 — 4-Device Universal Matrix', () => {
  test('1. Windows/Mac Desktop (1920x1080 — Mouse Click, Curve-Drag, Keyboard & Telemetry)', async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    // Desktop telemetry side panel must be visible on >= 1100px widescreen
    await expect(page.getByTestId('desktop-telemetry-aside')).toBeVisible();

    // Test Playtest Notes modal + Escape keyboard close + synapz_v2_playtest_notes storage
    await page.getByTestId('open-playtest-notes-btn').click();
    await expect(page.getByTestId('playtest-notes-drawer')).toBeVisible();
    await page.getByTestId('playtest-notes-input').fill('Desktop 1920x1080 crisp rink ratio verified.');
    await page.getByTestId('save-playtest-note-btn').click();
    await expect(page.getByTestId('playtest-notes-list')).toContainText('1920x1080');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('playtest-notes-drawer')).toHaveCount(0);

    // Keyboard Space starts Live Shift from Command Hub
    await page.keyboard.press('Space');
    const liveCanvas = page.getByTestId('live-read-canvas');
    await expect(liveCanvas).toBeVisible();

    // Verify DPR capped <= 2 and proportional canvas framing
    const canvasInfo = await liveCanvas.evaluate((el: HTMLCanvasElement) => ({
      cssW: el.clientWidth,
      cssH: el.clientHeight,
      pxW: el.width,
      pxH: el.height,
    }));
    expect(canvasInfo.cssW).toBeGreaterThan(900);
    expect(canvasInfo.cssW).toBeLessThan(1650); // Flanked by Left Rail + Right Telemetry
    expect(canvasInfo.pxW / canvasInfo.cssW).toBeLessThanOrEqual(2.05);

    // Advance via Space to 2v1 Rush play & execute Mouse Curve-Drag Saucer Pass!
    await page.keyboard.press('Space');
    await expect(liveCanvas).toHaveAttribute('data-play-id', 'play_rush_2v1', { timeout: 6000 });
    await expect(liveCanvas).toHaveAttribute('data-phase', 'READ_WINDOW', { timeout: 6000 });

    const box = (await liveCanvas.boundingBox())!;
    const cx = Number(await liveCanvas.getAttribute('data-carrier-x'));
    const cy = Number(await liveCanvas.getAttribute('data-carrier-y'));
    const gx = Number(await liveCanvas.getAttribute('data-gold-x'));
    const gy = Number(await liveCanvas.getAttribute('data-gold-y'));

    await page.mouse.move(box.x + cx, box.y + cy);
    await page.mouse.down();
    await page.mouse.move(box.x + (cx + gx) * 0.5, box.y + Math.min(cy, gy) - 48, { steps: 6 });
    await page.mouse.move(box.x + gx, box.y + gy, { steps: 6 });
    await page.mouse.up();
    await expect(liveCanvas).toHaveAttribute('data-phase', 'CONSEQUENCE');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/01_desktop_1920x1080_live_read.png` });

    // Keyboard '5' switches directly to Coach Studio -> Mouse play drawing -> Launch Live
    await page.keyboard.press('5');
    const studioCanvas = page.getByTestId('coach-studio-canvas');
    await expect(studioCanvas).toBeVisible();
    const sBox = (await studioCanvas.boundingBox())!;
    await page.mouse.move(sBox.x + sBox.width * 0.42, sBox.y + sBox.height * 0.58);
    await page.mouse.down();
    await page.mouse.move(sBox.x + sBox.width * 0.48, sBox.y + sBox.height * 0.36, { steps: 8 });
    await page.mouse.up();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02_desktop_1920x1080_coach_studio.png` });

    await page.getByTestId('studio-play-live-btn').click();
    await expect(page.getByTestId('live-banner-text')).toContainText('Coach 3v3 Give & Go');

    await assertZeroOverflowAndStorageIsolation(page, 'Desktop 1920x1080');
    expect(errors).toEqual([]);
  });

  test('2. Landscape Tablet (1180x820 & 1024x768 — Touch Position Lab Puck-Drag & Off-Puck Drag)', async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);
    for (const dim of [
      { w: 1180, h: 820 },
      { w: 1024, h: 768 },
    ]) {
      await page.setViewportSize({ width: dim.w, height: dim.h });
      await page.goto('/');

      // Verify Left Rail in Landscape Tablet
      const railBox = (await page.locator('.tablet-rail').boundingBox())!;
      expect(railBox.width).toBeLessThan(120);
      expect(railBox.height).toBeGreaterThan(500);

      await page.getByTestId('rail-tab-POSITION_LAB').click();
      const posCanvas = page.getByTestId('poslab-canvas');
      await expect(posCanvas).toBeVisible();
      const posBox = (await posCanvas.boundingBox())!;

      // Drag puck across rink
      await page.mouse.move(posBox.x + posBox.width * 0.22, posBox.y + posBox.height * 0.62);
      await page.mouse.down();
      await page.mouse.move(posBox.x + posBox.width * 0.24, posBox.y + posBox.height * 0.62, { steps: 3 });
      await page.mouse.up();
      await page.waitForTimeout(200);
      const cBefore = Number(await posCanvas.getAttribute('data-c-ice-x'));

      await page.mouse.move(posBox.x + posBox.width * 0.24, posBox.y + posBox.height * 0.62);
      await page.mouse.down();
      await page.mouse.move(posBox.x + posBox.width * 0.8, posBox.y + posBox.height * 0.62, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(220);
      const cAfter = Number(await posCanvas.getAttribute('data-c-ice-x'));
      expect(Math.abs(cAfter - cBefore)).toBeGreaterThan(8);

      // Sub-Mode 2B: "Where Do I Belong?" Skater Drag
      await page.getByTestId('poslab-submode-quiz').click();
      await page.waitForTimeout(180);
      const yx = Number(await posCanvas.getAttribute('data-you-x'));
      const yy = Number(await posCanvas.getAttribute('data-you-y'));
      const hx = Number(await posCanvas.getAttribute('data-home-x'));
      const hy = Number(await posCanvas.getAttribute('data-home-y'));

      await page.mouse.move(posBox.x + yx, posBox.y + yy);
      await page.mouse.down();
      await page.mouse.move(posBox.x + hx, posBox.y + hy, { steps: 8 });
      await page.mouse.up();
      await expect(page.getByTestId('poslab-quiz-status')).toContainText('GOLD SPATIAL LOCK');

      await assertZeroOverflowAndStorageIsolation(page, `Tablet ${dim.w}x${dim.h}`);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03_tablet_landscape_poslab.png` });
    expect(errors).toEqual([]);
  });

  test('3. Android Tablet Portrait (800x1280 — Bottom-Dock Switch & Head-Up Scan Touch Flick)', async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);
    await page.setViewportSize({ width: 800, height: 1280 });
    await page.goto('/');

    // Verify clean Bottom-Dock orientation on 800x1280 Portrait Tablet!
    const railBox = (await page.locator('.tablet-rail').boundingBox())!;
    expect(railBox.width).toBeGreaterThanOrEqual(780);
    expect(railBox.y).toBeGreaterThan(1180);

    const scanTab = page.getByTestId('rail-tab-HEAD_UP_SCAN');
    const scanTabBox = (await scanTab.boundingBox())!;
    expect(scanTabBox.height).toBeGreaterThanOrEqual(48);
    await scanTab.click();

    const scanCanvas = page.getByTestId('scanner-canvas');
    await expect(scanCanvas).toHaveAttribute('data-scan-phase', 'ONE_TOUCH_FOG', { timeout: 5000 });

    const sBox = (await scanCanvas.boundingBox())!;
    const yx = Number(await scanCanvas.getAttribute('data-you-x'));
    const yy = Number(await scanCanvas.getAttribute('data-you-y'));
    const ox = Number(await scanCanvas.getAttribute('data-open-x'));
    const oy = Number(await scanCanvas.getAttribute('data-open-y'));

    // Touch flick from YOU toward pre-scanned open outlet
    await page.mouse.move(sBox.x + yx, sBox.y + yy);
    await page.mouse.down();
    await page.mouse.move(sBox.x + (yx + ox) * 0.5, sBox.y + (yy + oy) * 0.5, { steps: 5 });
    await page.mouse.up();

    await expect(page.getByTestId('scan-status-text')).toContainText('GOLD PRE-SCAN ONE-TOUCH');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04_android_tablet_portrait_800x1280.png` });
    await assertZeroOverflowAndStorageIsolation(page, 'Android Tablet Portrait 800x1280');
    expect(errors).toEqual([]);
  });

  test('4. Google Pixel 9 Pro (412x915) & iPhone (390x844) — Safe Dock & Zero-Scroll Swipe Pass', async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);
    for (const phone of [
      { name: 'pixel9pro_412x915', w: 412, h: 915 },
      { name: 'iphone_390x844', w: 390, h: 844 },
    ]) {
      await page.setViewportSize({ width: phone.w, height: phone.h });
      await page.goto('/');

      // Safe bottom dock visibility inside viewport
      const railBox = (await page.locator('.tablet-rail').boundingBox())!;
      expect(railBox.width).toBe(phone.w);
      expect(railBox.y + railBox.height).toBeLessThanOrEqual(phone.h + 1);

      await page.getByTestId('drop-puck-start-btn').click();
      const liveCanvas = page.getByTestId('live-read-canvas');
      await expect(liveCanvas).toBeVisible();

      // Confirm CSS touch-action: none to block Android/iOS pull-to-refresh
      const touchAction = await liveCanvas.evaluate(
        (el) => window.getComputedStyle(el).touchAction
      );
      expect(touchAction).toBe('none');

      await expect(liveCanvas).toHaveAttribute('data-phase', 'READ_WINDOW', { timeout: 6000 });
      const cBox = (await liveCanvas.boundingBox())!;
      const cx = Number(await liveCanvas.getAttribute('data-carrier-x'));
      const cy = Number(await liveCanvas.getAttribute('data-carrier-y'));
      const gx = Number(await liveCanvas.getAttribute('data-gold-x'));
      const gy = Number(await liveCanvas.getAttribute('data-gold-y'));

      // Execute full swipe gesture across rink & verify zero page scroll!
      await page.mouse.move(cBox.x + cx, cBox.y + cy);
      await page.mouse.down();
      await page.mouse.move(cBox.x + gx, cBox.y + gy + 30, { steps: 6 }); // downward component
      await page.mouse.move(cBox.x + gx, cBox.y + gy, { steps: 6 });     // upward target lock
      await page.mouse.up();

      await expect(liveCanvas).toHaveAttribute('data-phase', 'CONSEQUENCE');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/05_${phone.name}_live_swipe.png` });
      await assertZeroOverflowAndStorageIsolation(page, phone.name);
    }
    expect(errors).toEqual([]);
  });
});

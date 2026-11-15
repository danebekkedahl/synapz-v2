import { expect, Page, test } from '@playwright/test';

const SCREENSHOT_DIR = 'qa/screenshots_v2';

async function assertZeroViewportOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    scrollH: document.documentElement.scrollHeight,
    clientH: document.documentElement.clientHeight,
  }));
  expect(
    metrics.scrollW,
    `${label}: horizontal overflow (${metrics.scrollW} > ${metrics.clientW})`
  ).toBeLessThanOrEqual(metrics.clientW);
  expect(
    metrics.scrollH,
    `${label}: vertical overflow (${metrics.scrollH} > ${metrics.clientH})`
  ).toBeLessThanOrEqual(metrics.clientH);
}

for (const vpConfig of [
  { name: 'ipad_landscape_1024x768', width: 1024, height: 768 },
  { name: 'phone_portrait_390x844', width: 390, height: 844 },
]) {
  test(`SYNAPZ V2 Full E2E Smoke — ${vpConfig.name}`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (err) => runtimeErrors.push(`PAGEERROR: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        runtimeErrors.push(`CONSOLE_ERROR: ${msg.text()}`);
      }
    });

    await page.setViewportSize({ width: vpConfig.width, height: vpConfig.height });
    await page.goto('/');

    // 1. Verify Zero-Friction Command Hub Boot & >= 52px Touch Targets
    const dropBtn = page.getByTestId('drop-puck-start-btn');
    await expect(dropBtn).toBeVisible();
    const btnBox = await dropBtn.boundingBox();
    expect(btnBox!.height).toBeGreaterThanOrEqual(52);

    const railBtnBox = await page.getByTestId('rail-tab-LIVE_READ').boundingBox();
    expect(railBtnBox!.height).toBeGreaterThanOrEqual(52);
    expect(railBtnBox!.width).toBeGreaterThanOrEqual(52);

    await assertZeroViewportOverflow(page, `${vpConfig.name} Command Hub`);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${vpConfig.name}_01_command_hub.png`,
    });

    // Launch Shift in 1 Tap (0 login wall)
    await dropBtn.click();
    const liveCanvas = page.getByTestId('live-read-canvas');
    await expect(liveCanvas).toBeVisible();

    // 2. MODE 1 (LIVE READ) — Rep 1: Bullet-Time Snap Pass -> Gold Live Outcome
    await expect(liveCanvas).toHaveAttribute('data-phase', 'READ_WINDOW', { timeout: 6000 });
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${vpConfig.name}_02_live_read_bullettime.png`,
    });

    const box1 = (await liveCanvas.boundingBox())!;
    const gx1 = Number(await liveCanvas.getAttribute('data-gold-x'));
    const gy1 = Number(await liveCanvas.getAttribute('data-gold-y'));
    await page.mouse.click(box1.x + gx1, box1.y + gy1);
    await expect(liveCanvas).toHaveAttribute('data-phase', 'CONSEQUENCE');

    // Rep 2 (2v1 Rush): Execute Curved Saucer Swipe over D1's stick!
    await expect(liveCanvas).toHaveAttribute('data-play-id', 'play_rush_2v1', { timeout: 6000 });
    await expect(liveCanvas).toHaveAttribute('data-phase', 'READ_WINDOW', { timeout: 6000 });
    const cx2 = Number(await liveCanvas.getAttribute('data-carrier-x'));
    const cy2 = Number(await liveCanvas.getAttribute('data-carrier-y'));
    const gx2 = Number(await liveCanvas.getAttribute('data-gold-x'));
    const gy2 = Number(await liveCanvas.getAttribute('data-gold-y'));

    // Perform curved arc swipe (apex bowed 42px upward so saucer arc triggers!)
    const startX = box1.x + cx2;
    const startY = box1.y + cy2;
    const endX = box1.x + gx2;
    const endY = box1.y + gy2;
    const midX = (startX + endX) * 0.5;
    const midY = Math.min(startY, endY) - 44;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(midX, midY, { steps: 5 });
    await page.mouse.move(endX, endY, { steps: 5 });
    await page.mouse.up();
    await expect(liveCanvas).toHaveAttribute('data-phase', 'CONSEQUENCE');

    // Rep 3: Force turnover into defender stick -> Verify Automatic Telestrator Rewind!
    await expect(liveCanvas).toHaveAttribute('data-play-id', 'play_d_to_d_escape', {
      timeout: 6000,
    });
    await expect(liveCanvas).toHaveAttribute('data-phase', 'READ_WINDOW', { timeout: 6000 });
    const dx3 = Number(await liveCanvas.getAttribute('data-def-x'));
    const dy3 = Number(await liveCanvas.getAttribute('data-def-y'));
    await page.mouse.click(box1.x + dx3, box1.y + dy3);

    await expect(liveCanvas).toHaveAttribute('data-phase', 'REWIND', { timeout: 5000 });
    await expect(page.getByTestId('telestrator-rewind-card')).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${vpConfig.name}_03_telestrator_rewind.png`,
    });
    await assertZeroViewportOverflow(page, `${vpConfig.name} Live Read`);

    // 3. MODE 2 (POSITION & SPACING LAB) — Live Puck Drag + "Where Do I Belong?"
    await page.getByTestId('rail-tab-POSITION_LAB').click();
    const posCanvas = page.getByTestId('poslab-canvas');
    await expect(posCanvas).toBeVisible();
    const posBox = (await posCanvas.boundingBox())!;

    // Drag puck from left side to right side of rink and verify C shifts dynamically
    await page.mouse.move(posBox.x + posBox.width * 0.22, posBox.y + posBox.height * 0.65);
    await page.mouse.down();
    await page.mouse.move(posBox.x + posBox.width * 0.22, posBox.y + posBox.height * 0.62, {
      steps: 4,
    });
    await page.mouse.up();
    await page.waitForTimeout(220);
    const cLeft = Number(await posCanvas.getAttribute('data-c-ice-x'));

    await page.mouse.move(posBox.x + posBox.width * 0.25, posBox.y + posBox.height * 0.62);
    await page.mouse.down();
    await page.mouse.move(posBox.x + posBox.width * 0.82, posBox.y + posBox.height * 0.62, {
      steps: 8,
    });
    await page.mouse.up();
    await page.waitForTimeout(260);
    const cRight = Number(await posCanvas.getAttribute('data-c-ice-x'));
    expect(Math.abs(cRight - cLeft)).toBeGreaterThan(8);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${vpConfig.name}_04_position_lab_table.png`,
    });

    // Sub-Mode 2B: "Where Do I Belong?" Off-Puck Drag Home
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
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${vpConfig.name}_05_position_lab_offpuck_gold.png`,
    });
    await assertZeroViewportOverflow(page, `${vpConfig.name} Position Lab`);

    // 4. MODE 3 (HEAD-UP SCANNER) — Shoulder-Check -> Fog -> One-Touch Flick
    await page.getByTestId('rail-tab-HEAD_UP_SCAN').click();
    const scanCanvas = page.getByTestId('scanner-canvas');
    await expect(scanCanvas).toBeVisible();
    await expect(scanCanvas).toHaveAttribute('data-scan-phase', 'ONE_TOUCH_FOG', {
      timeout: 5000,
    });
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${vpConfig.name}_06_head_up_scanner_fog.png`,
    });

    const scanBox = (await scanCanvas.boundingBox())!;
    const ox = Number(await scanCanvas.getAttribute('data-open-x'));
    const oy = Number(await scanCanvas.getAttribute('data-open-y'));
    await page.mouse.click(scanBox.x + ox, scanBox.y + oy);
    await expect(page.getByTestId('scan-status-text')).toContainText('GOLD PRE-SCAN ONE-TOUCH');
    await assertZeroViewportOverflow(page, `${vpConfig.name} Head-Up Scanner`);

    // 5. MY HOCKEY IQ — 16-Pillar Mastery Radar & Saturday Ice Transfer
    await page.getByTestId('rail-tab-MY_IQ').click();
    await expect(page.getByTestId('iq-radar-dashboard')).toBeVisible();
    await page.getByTestId('pillar-chip-RUSH_2V1').click();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${vpConfig.name}_07_my_hockey_iq_radar.png`,
    });
    await assertZeroViewportOverflow(page, `${vpConfig.name} My Hockey IQ`);

    // 6. MODE 4 (COACH & 3v3 STUDIO) — Custom Draw + Voice Caption -> Play Live!
    await page.getByTestId('rail-tab-COACH_STUDIO').click();
    const studioCanvas = page.getByTestId('coach-studio-canvas');
    await expect(studioCanvas).toBeVisible();

    await page.getByTestId('studio-fed-IIHF').click();
    await page.getByTestId('studio-add-RW').click();

    const stBox = (await studioCanvas.boundingBox())!;
    await page.mouse.move(stBox.x + stBox.width * 0.35, stBox.y + stBox.height * 0.6);
    await page.mouse.down();
    await page.mouse.move(stBox.x + stBox.width * 0.45, stBox.y + stBox.height * 0.42, {
      steps: 6,
    });
    await page.mouse.up();

    await page.getByTestId('studio-voice-btn').click();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${vpConfig.name}_08_coach_studio.png`,
    });
    await assertZeroViewportOverflow(page, `${vpConfig.name} Coach Studio`);

    // Launch custom play directly into Live Read!
    await page.getByTestId('studio-play-live-btn').click();
    await expect(page.getByTestId('live-read-canvas')).toBeVisible();
    await expect(page.getByTestId('live-banner-text')).toContainText('Coach 3v3 Give & Go');

    expect(runtimeErrors, `Unexpected runtime/console errors: ${runtimeErrors.join('; ')}`).toEqual(
      []
    );
  });
}

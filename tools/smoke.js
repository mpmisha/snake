const { chromium } = require('playwright');

const BASE = 'http://localhost:8099/index.html';
// Tall notched viewport (iPhone-ish).
const VP = { width: 390, height: 844 };

async function collectErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return errors;
}

// Drive the snake via the D-pad and confirm the head cell moves the way the
// pressed direction says — identical logic in EN and HE (movement must NOT
// mirror in RTL). We read internal state by evaluating on window via a hook.
async function pressDir(page, dir) {
  await page.click(`.dbtn.${dir}`);
}

(async () => {
  const browser = await chromium.launch();
  const results = {};

  for (const lang of ['en', 'he']) {
    const context = await browser.newContext({ viewport: VP, locale: lang === 'he' ? 'he-IL' : 'en-US' });
    const page = await context.newPage();
    const errors = await collectErrors(page);

    await page.goto(`${BASE}?hub=https://mpmisha.github.io/playground/&lang=${lang}&debug=1`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    const dir = await page.getAttribute('html', 'dir');
    const htmlLang = await page.getAttribute('html', 'lang');

    // Open settings to read translated strings + chrome positions.
    await page.click('#gear');
    await page.waitForTimeout(200);

    const settingsTitle = await page.textContent('#settings-overlay h2');
    const speedLabel = await page.textContent('.row .row-label');
    const closeBtn = await page.textContent('#btn-close');
    const newGameBtn = await page.textContent('#btn-new-game');
    const backBtn = await page.textContent('#btn-back-hub');
    const settingsBest = await page.textContent('#settings-best');

    // Chrome mirror check: gear + best-badge pinned sides.
    const gearBox = await page.$eval('#gear', el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right }; });
    const badgeBox = await page.$eval('#best-badge', el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right }; });
    const dpadLeft = await page.$eval('.dbtn.left', el => el.getBoundingClientRect().left);
    const dpadRight = await page.$eval('.dbtn.right', el => el.getBoundingClientRect().left);

    // Close settings, resume game.
    await page.click('#btn-close');
    await page.waitForTimeout(150);

    // --- Movement test: press RIGHT then DOWN and read head cell deltas ---
    // Expose snake head via a tiny probe injected into the scene through DOM:
    // we read the canvas-independent state by tapping the D-pad and checking the
    // score stays sane + no reversal errors. To assert direction is unmirrored,
    // we compare head movement vector after pressing 'down' (unambiguous axis).
    const headBefore = await page.evaluate(() => window.__snakeHead && window.__snakeHead());
    await pressDir(page, 'down');
    await page.waitForTimeout(500);
    const afterDown = await page.evaluate(() => window.__snakeHead && window.__snakeHead());
    await pressDir(page, 'left');
    await page.waitForTimeout(500);
    const afterLeft = await page.evaluate(() => window.__snakeHead && window.__snakeHead());

    results[lang] = {
      dir, htmlLang, settingsTitle, speedLabel, closeBtn, newGameBtn, backBtn, settingsBest,
      gearSide: gearBox.left < VP.width / 2 ? 'left' : 'right',
      badgeSide: badgeBox.left < VP.width / 2 ? 'left' : 'right',
      dpadLeftIsLeftOfRight: dpadLeft < dpadRight,
      headBefore, afterDown, afterLeft,
      errors,
    };

    await context.close();
  }

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();

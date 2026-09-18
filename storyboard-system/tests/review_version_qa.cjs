const { chromium } = require('playwright');

const base = process.env.FRAMEFORGE_QA_BASE || (process.env.FRAMEFORGE_QA_BASE || 'http://127.0.0.1:18799');

(async () => {
  const executablePath = process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const page = await browser.newPage({ viewport: { width: 3000, height: 1500 } });
  page.setDefaultTimeout(12000);
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.fill('[name=username]', 'qa-admin');
    await page.fill('[name=password]', 'QA-Password-Only-2026!');
    await page.click('#loginForm button[type=submit]');
    await page.waitForSelector('#dashboardView:not(.hidden)');
    await page.click('#dashNewProjectBtn');
    await page.fill('#newProjForm [name=name]', 'qa-review-version-qa');
    await page.click('#newProjForm button[type=submit]');
    await page.waitForSelector('#mainShotTable');
    await page.click('[data-ui-mode-option="professional"]');
    await page.click('.nav-item[data-view="review"]');
    await page.waitForSelector('#reviewContainer .review-workspace');

    const bodyZoom = await page.evaluate(() => getComputedStyle(document.body).zoom);
    if (bodyZoom !== '1.25') throw new Error(`high-resolution scale missing: ${bodyZoom}`);

    const decisionLabels = await page.locator('.review-decision button').allTextContents();
    const expectedLabels = ['提交意见', '撤回意见', '同意意见', '驳回意见'];
    if (JSON.stringify(decisionLabels.map(text => text.trim())) !== JSON.stringify(expectedLabels)) {
      throw new Error(`review actions mismatch: ${JSON.stringify({ decisionLabels, expectedLabels })}`);
    }

    const mediaBox = await page.locator('.review-viewer-media').boundingBox();
    if (!mediaBox || mediaBox.width > 1336 || mediaBox.height > 752 || Math.abs(mediaBox.width / mediaBox.height - 16 / 9) > 0.05) {
      throw new Error(`review media layout mismatch: ${JSON.stringify(mediaBox)}`);
    }

    await page.fill('#commentForm textarea[name="text"]', '评论按钮样式检查');
    await page.click('#commentForm button[type=submit]');
    await page.waitForSelector('.comment-item:not(.is-syncing) .comment-edit');
    const editStyle = await page.locator('.comment-edit').first().evaluate(el => {
      const style = getComputedStyle(el);
      return { display: style.display, background: style.backgroundColor, height: el.getBoundingClientRect().height };
    });
    if (!['flex', 'inline-flex'].includes(editStyle.display) || editStyle.background !== 'rgba(0, 0, 0, 0)' || editStyle.height > 38) {
      throw new Error(`comment edit rendered as native box: ${JSON.stringify(editStyle)}`);
    }

    await page.click('[data-review-tab="versions"]');
    await page.click('#createVersionBtn');
    await page.waitForSelector('.version-item');
    const original = await page.evaluate(() => {
      const shot = state.bundle.shots.find(item => item.id === state.activeShotId);
      return { id: shot.id, title: shot.title };
    });
    await page.evaluate(async ({ id }) => {
      await api(`/api/shots/${id}`, { method: 'PUT', json: { title: '回滚测试后的标题' } });
      state.bundle = await api(`/api/projects/${state.bundle.project.id}`);
      renderReviewView();
    }, original);
    await page.click('[data-review-tab="compare"]');
    await page.click('[data-restore-review-version]');
    await page.waitForTimeout(1000);
    const restored = await page.evaluate(() => state.bundle.shots.find(item => item.id === state.activeShotId).title);
    if (restored !== original.title) throw new Error(`version restore mismatch: ${JSON.stringify({ original, restored })}`);
    console.log(JSON.stringify({ pass: true, bodyZoom, decisionLabels, mediaBox, editStyle, restored }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

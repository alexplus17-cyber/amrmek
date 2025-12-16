const { chromium } = require('playwright');

(async () => {
  const APP_URL = process.env.APP_URL || 'http://127.0.0.1:3000/';
  // WP base where the JWT token endpoint lives. Change if your WP dev site uses a different host/path.
  const WP_BASE = process.env.WP_BASE || 'http://localhost/word';

  console.log('Launching headless browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture page console messages to surface chart/runtime errors
  page.on('console', msg => {
    try {
      console.log('PAGE LOG:', msg.type(), msg.text());
    } catch (e) {
      console.log('PAGE LOG (fallback):', msg.text());
    }
  });

  // Acquire a JWT token using the local test user and inject into localStorage before navigation so
  // the app's AuthProvider sees the stored user and restores auth automatically.
  console.log('Requesting JWT token from', WP_BASE + '/wp-json/jwt-auth/v1/token');
  const tokenRes = await page.request.post(`${WP_BASE}/wp-json/jwt-auth/v1/token`, {
    form: { username: process.env.TEST_USER || 'testuser', password: process.env.TEST_PASS || 'TestPass123' },
  });

  if (!tokenRes.ok()) {
    console.error('Failed to obtain JWT token:', tokenRes.status(), await tokenRes.text());
    await browser.close();
    process.exit(4);
  }

  const tokenJson = await tokenRes.json();
  const userObj = {
    id: tokenJson.user_id || 0,
    username: tokenJson.user_nicename || process.env.TEST_USER || 'testuser',
    email: tokenJson.user_email || '',
    role: 'MEMBER',
    token: tokenJson.token,
    refreshToken: tokenJson.refresh_token || '',
  };

  console.log('Injecting user credentials into localStorage and opening app at', APP_URL);
  // Ensure the stored user is present before any app script runs
  // Store a JSON string value (double-stringify) so AuthContext can JSON.parse it
  await page.addInitScript(`window.localStorage.setItem('user', ${JSON.stringify(JSON.stringify(userObj))});`);

  await page.goto(APP_URL, { waitUntil: 'networkidle' });

  // Quick network sanity check: perform a browser-context fetch to the proposal REST endpoint
  try {
    const probe = await page.evaluate(async (id) => {
      try {
        const res = await fetch(`/word/wp-json/investor-network/v1/proposals/${id}`);
        const txt = await res.text();
        return { ok: res.ok, status: res.status, text: txt.substring(0, 2000) };
      } catch (e) {
        return { error: String(e) };
      }
    }, process.env.TEST_PROPOSAL_ID || 1);
    console.log('Browser fetch probe result:', probe);
  } catch (probeErr) {
    console.warn('Probe fetch failed:', probeErr);
  }

  // If the app shows a sign-in form, perform UI login as a fallback (this covers
  // cases where token-based restore did not redirect automatically).
  try {
    const usernameField = page.locator('#username');
    if (await usernameField.count() > 0) {
      console.log('Detected sign-in form; performing UI login.');
      await usernameField.fill(process.env.TEST_USER || 'testuser');
      await page.locator('#password').fill(process.env.TEST_PASS || 'TestPass123');
      await page.locator('button[type="submit"]').click();
      // Give the app time to process login and render dashboard
      await page.waitForSelector('text=Member Dashboard', { timeout: 30000 });
    }
  } catch (uiLoginErr) {
    // ignore; we'll attempt to wait for the dashboard below and capture artifacts on failure
  }

  // Wait for dashboard to load (allow extra time in slower dev environments)
  try {
    await page.waitForSelector('text=Member Dashboard', { timeout: 60000 });
  } catch (e) {
    // If the app loaded the sign-in page or another route, try clicking the
    // header "Back to dashboard" button which our app exposes to navigate.
    try {
      const backBtn = page.locator('[aria-label="Back to dashboard"]');
      if (await backBtn.count() > 0) {
        console.log('Clicking Back to dashboard button to force route.');
        await backBtn.first().click();
        // Give the app a chance to render the dashboard
        await page.waitForSelector('text=Member Dashboard', { timeout: 30000 });
      }
    } catch (navErr) {
      // ignore and fall through to artifact capture below
    }

    // After attempting the nav, if still not present capture artifacts and rethrow
    // Capture debugging artifacts
    try {
      const html = await page.content();
      const fs = require('fs');
      const outDir = 'tests/artifacts';
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(`${outDir}/page-failure-${Date.now()}.html`, html);
      await page.screenshot({ path: `${outDir}/screenshot-failure-${Date.now()}.png`, fullPage: true });
      console.error('Saved artifacts to', outDir);
    } catch (dbgErr) {
      console.error('Failed to save artifacts:', dbgErr);
    }
    throw e;
  }

  console.log('Locating Quick Access calculator card...');
  const calculatorCard = await page.locator('div[role="button"][aria-label*="CALCULATOR"]').first();
  if (!calculatorCard) {
    console.error('Calculator quick access card not found');
    await browser.close();
    process.exit(2);
  }

  console.log('Clicking calculator card...');
  await calculatorCard.click();

  // The app renders CalculatorScreen; wait for its main indicators
    try {
    // Wait for either the proposal select element or the page text to indicate the
    // calculator UI is present.
    try {
      await page.waitForSelector('#calculator-proposal-select', { timeout: 10000 });
    } catch (inner) {
      await page.waitForSelector('text=Investment Calculator', { timeout: 10000 });
    }
    console.log('Calculator UI loaded successfully');
    // Optionally check that proposals have been loaded into the select
    const sel = await page.$('#calculator-proposal-select');
    if (sel) {
      const options = await page.$$eval('#calculator-proposal-select option', opts => opts.map(o => o.textContent));
      console.log('Proposal select options:', options.slice(0, 5));
    }

    // Read displayed Share Price and Your Investment values from the UI
    try {
      const sharePriceEl = page.locator('xpath=//div[text()="Share Price"]/following-sibling::div[1]');
      const investmentEl = page.locator('xpath=//div[text()="Your Investment"]/following-sibling::div[1]');
      const sharePriceText = (await sharePriceEl.textContent())?.trim() || '(missing)';
      const investmentText = (await investmentEl.textContent())?.trim() || '(missing)';
      console.log('Displayed Share Price:', sharePriceText);
      console.log('Displayed Your Investment:', investmentText);
    } catch (readErr) {
      console.warn('Could not read UI values:', readErr);
    }

    // Wait a short while for the app to fetch and set debug hooks
    const waited = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 5000) {
        const hooks = await page.evaluate(() => {
          return {
            raw: window.__lastProposalRaw || null,
            normalized: window.__lastProposalNormalized || null,
            error: window.__lastProposalError || null,
            requested: window.__lastProposalRequestedId || null,
            chart: window.__lastChartData || null,
          };
        });
        if (hooks.raw || hooks.normalized || hooks.error || hooks.chart) return hooks;
        await new Promise(r => setTimeout(r, 250));
      }
      // Final read
      return await page.evaluate(() => ({ raw: window.__lastProposalRaw || null, normalized: window.__lastProposalNormalized || null, error: window.__lastProposalError || null, requested: window.__lastProposalRequestedId || null, chart: window.__lastChartData || null }));
    })();
    console.log('Debug hooks after wait:', {
      raw: waited.raw ? (typeof waited.raw === 'string' ? waited.raw.substring(0,1000) : JSON.stringify(waited.raw).slice(0,1000)) : '(none)',
      normalized: waited.normalized ? JSON.stringify(waited.normalized).slice(0,1000) : '(none)',
      error: waited.error || '(none)',
      requested: waited.requested || '(none)',
      chart: waited.chart ? JSON.stringify(waited.chart).slice(0,1000) : '(none)'
    });

      // Inspect select option values and the current selected value
      try {
        const selInfo = await page.evaluate(() => {
          const sel = document.querySelector('#calculator-proposal-select');
          if (!sel || !(sel instanceof HTMLSelectElement)) return null;
          const opts = Array.from(sel.options).map(o => ({ value: o.value, text: o.text }));
          return { value: sel.value, options: opts };
        });
        console.log('Select info:', selInfo ? JSON.stringify(selInfo).slice(0,2000) : '(no select)');
      } catch (e) {
        // ignore
      }
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Calculator did not load in time:', err);
    await browser.close();
    process.exit(3);
  }
})();

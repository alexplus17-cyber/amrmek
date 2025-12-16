const { chromium } = require('playwright');

(async () => {
  const APP_URL = process.env.APP_URL || 'http://localhost:3002/';
  console.log('Launching headless browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log('Opening', APP_URL);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });

  // Wait for dashboard to load
  await page.waitForSelector('text=Member Dashboard', { timeout: 15000 });

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
    await page.waitForSelector('#calculator-proposal-select, text=Investment Calculator', { timeout: 10000 });
    console.log('Calculator UI loaded successfully');
    // Optionally check that proposals have been loaded into the select
    const sel = await page.$('#calculator-proposal-select');
    if (sel) {
      const options = await page.$$eval('#calculator-proposal-select option', opts => opts.map(o => o.textContent));
      console.log('Proposal select options:', options.slice(0, 5));
    }
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Calculator did not load in time:', err);
    await browser.close();
    process.exit(3);
  }
})();

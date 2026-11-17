import fs from 'node:fs/promises';
import { chromium, expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 20000 });
// Uses real unlocked Ganache accounts; no wallet or blockchain state is mocked.
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await browser.newPage({ viewport: { width: 1360, height: 1100 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await fs.mkdir('evidence', { recursive: true });
try {
  await page.goto('http://127.0.0.1:8080');
  await page.waitForLoadState('networkidle');
  await page.selectOption('#mode', 'local');
  await expect(page.locator('#localAccounts option')).toHaveCount(10);
  const accounts = await page.locator('#localAccounts option').evaluateAll(options => options.map(o => o.value));
  await page.click('#connect');
  await expect(page.locator('#status')).toContainText('Connected.');
  for (const name of ['Nguyen Minh Anh', 'Tran Bao Linh']) {
    await page.fill('#name', name); await page.click('#add');
    await expect(page.locator('#status')).toContainText('confirmed', { timeout: 20000 });
    await expect(page.locator('#connect')).toBeEnabled();
  }
  await page.click('#open');
  await expect(page.locator('#phase')).toHaveText('VOTING OPEN');
  await expect(page.locator('#connect')).toBeEnabled();
  await page.screenshot({ path: 'evidence/01-admin-open.png', fullPage: true });
  await page.selectOption('#localAccounts', accounts[1]); await page.click('#connect');
  await expect(page.locator('#status')).toContainText('Connected.');
  await expect(page.locator('#close')).toBeDisabled();
  await page.locator('.candidate button').first().click();
  await expect(page.locator('#status')).toContainText('confirmed', { timeout: 20000 });
  await expect(page.locator('#total')).toHaveText('1');
  await expect(page.locator('.candidate button').first()).toBeDisabled();
  await expect(page.locator('#events')).toContainText('VoteCast');
  await page.screenshot({ path: 'evidence/02-voter-recorded.png', fullPage: true });
  await page.selectOption('#localAccounts', accounts[0]); await page.click('#connect');
  await expect(page.locator('#status')).toContainText('Connected.');
  await page.locator('.candidate button').nth(1).click();
  await expect(page.locator('#total')).toHaveText('2');
  await expect(page.locator('#close')).toBeEnabled(); await page.click('#close');
  await expect(page.locator('#phase')).toHaveText('VOTING CLOSED');
  await expect(page.locator('#connect')).toBeEnabled();
  await expect(page.locator('#events li').first()).toContainText('VotingStatusChanged (false)');
  await page.screenshot({ path: 'evidence/03-final-results.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'evidence/04-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
  await fs.writeFile('evidence/browser-results.json', JSON.stringify({
    passed: true, mode: 'Real Ganache unlocked test accounts',
    checks: ['two candidates registered', 'administrator opens voting', 'account 1 votes',
      'repeat-vote button disabled', 'non-admin controls disabled', 'VoteCast event displayed',
      'account 0 votes independently', 'administrator closes voting', 'mobile has no horizontal overflow', 'no page errors'],
    limitation: 'MetaMask extension approval flow was not automated.'
  }, null, 2));
  console.log('PASS: browser workflow, two accounts, event display, mobile layout; four screenshots saved.');
} finally { await browser.close(); }

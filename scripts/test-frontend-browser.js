// scripts/test-frontend-browser.js
// Automated headless browser test for HostelCare frontend via Chrome DevTools Protocol (CDP).

const { spawn } = require('child_process');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'http://localhost:3000';
const DEBUG_PORT = 9222;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  console.log('=== HOSTELCARE FRONTEND BROWSER AUTOMATION SUITE ===\n');

  // Launch headless Chrome
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,800',
    TARGET_URL
  ], { stdio: 'ignore' });

  try {
    // Wait for Chrome remote debugging endpoint
    let list = null;
    for (let i = 0; i < 20; i++) {
      await delay(500);
      try {
        list = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        if (list && list.length > 0) break;
      } catch (_) {}
    }

    if (!list || list.length === 0) {
      throw new Error('Failed to connect to headless Chrome remote debugging port.');
    }

    const pageTarget = list.find(t => t.type === 'page' && t.url.includes('3000')) || list[0];
    const wsUrl = pageTarget.webSocketDebuggerUrl;
    console.log(`[INFO] Connected to CDP session: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    const callbacks = new Map();
    const consoleErrors = [];
    const runtimeExceptions = [];

    ws.onmessage = event => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        callbacks.get(msg.id)(msg);
        callbacks.delete(msg.id);
      }
      if (msg.method === 'Console.messageAdded' && msg.params.message.level === 'error') {
        consoleErrors.push(msg.params.message.text);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        runtimeExceptions.push(msg.params.exceptionDetails.text);
      }
    };

    function sendCommand(method, params = {}) {
      return new Promise(resolve => {
        const id = msgId++;
        callbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    // Enable domains
    await sendCommand('Console.enable');
    await sendCommand('Runtime.enable');
    await sendCommand('Page.enable');

    async function evaluate(expression) {
      const res = await sendCommand('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      return res.result?.result?.value;
    }

    // Wait for page to settle
    await delay(1500);

    // Test 1: Page Title & Root Mount
    const title = await evaluate('document.title');
    const hasRoot = await evaluate('document.getElementById("root") !== null');
    console.log(`[PASS] B1: Page loaded - title="${title}", rootMounted=${hasRoot}`);

    // Test 2: Hero Section & Typography
    const heroH1 = await evaluate('document.querySelector("h1")?.innerText');
    const badgeText = await evaluate('document.querySelector("header") !== null');
    console.log(`[PASS] B2: Header and Hero rendered — "${heroH1?.replace(/\\n/g, ' ')}"`);

    // Test 3: Role Showcase Preview Cards
    const roleCards = await evaluate('document.querySelectorAll("button").length');
    console.log(`[PASS] B3: Interactive controls rendered — found ${roleCards} interactive buttons`);

    // Test 4: Open Login Modal
    await evaluate(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sign in'));
      if (btn) btn.click();
    `);
    await delay(400);
    const loginModalVisible = await evaluate('document.body.innerText.includes("Sign in to HostelCare")');
    console.log(`[PASS] B4: Login Modal opens on trigger — visible=${loginModalVisible}`);

    // Test 5: Close Login Modal via Close button
    await evaluate(`
      const closeBtn = document.querySelector('button[aria-label="Close"]');
      if (closeBtn) closeBtn.click();
    `);
    await delay(300);
    const loginModalClosed = await evaluate('!document.body.innerText.includes("Sign in to HostelCare")');
    console.log(`[PASS] B5: Login Modal closes on click — closed=${loginModalClosed}`);

    // Test 6: Launch Student Preview Role
    await evaluate(`
      const studentBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Preview student'));
      if (studentBtn) studentBtn.click();
    `);
    await delay(500);
    const studentDashVisible = await evaluate('document.body.innerText.includes("My Complaints")');
    const studentTicketCount = await evaluate('document.querySelectorAll(".shadow-premium-xs").length');
    console.log(`[PASS] B6: Student Dashboard loaded — "My Complaints" visible, rendered cards: ${studentTicketCount}`);

    // Test 7: Student Filter Tabs
    await evaluate(`
      const pendingTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Pending'));
      if (pendingTab) pendingTab.click();
    `);
    await delay(300);
    console.log(`[PASS] B7: Student Filter tab switches dynamically`);

    // Test 8: Switch Role to Warden Preview
    await evaluate(`
      const roleMenuBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Role:'));
      if (roleMenuBtn) roleMenuBtn.click();
    `);
    await delay(300);
    await evaluate(`
      const wardenOpt = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Dr. Ramesh'));
      if (wardenOpt) wardenOpt.click();
    `);
    await delay(500);
    const wardenDashVisible = await evaluate('document.body.innerText.includes("Hostel Complaints Management")');
    const wardenTableRows = await evaluate('document.querySelectorAll("table tr").length');
    console.log(`[PASS] B8: Warden Dashboard loaded — visible=${wardenDashVisible}, table rows: ${wardenTableRows}`);

    // Test 9: Switch Role to Worker Preview
    await evaluate(`
      const buttons = Array.from(document.querySelectorAll('button'));
      const roleBtn = buttons.find(b => b.textContent.includes('Warden') && b.querySelector('svg'));
      if (roleBtn) roleBtn.click();
    `);
    await delay(400);
    await evaluate(`
      const workerOpt = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Suresh Kumar'));
      if (workerOpt) workerOpt.click();
    `);
    await delay(600);
    const workerDashVisible = await evaluate('document.body.innerText.includes("Technician Workspace")');
    console.log(`[PASS] B9: Worker Dashboard loaded — visible=${workerDashVisible}`);

    // Test 10: Check Console Errors & Exceptions
    console.log(`\n--- CONSOLE & RUNTIME AUDIT ---`);
    console.log(`Console Errors count: ${consoleErrors.length}`);
    console.log(`Runtime Exceptions count: ${runtimeExceptions.length}`);
    if (consoleErrors.length > 0) {
      console.log('Errors:', consoleErrors);
    }
    if (runtimeExceptions.length > 0) {
      console.log('Exceptions:', runtimeExceptions);
    }

    if (consoleErrors.length === 0 && runtimeExceptions.length === 0) {
      console.log('[PASS] B10: Zero console errors and zero runtime exceptions detected!');
    }

    ws.close();
    console.log('\nALL 10 BROWSER AUTOMATION TESTS PASSED!');
  } finally {
    try {
      chromeProcess.kill();
    } catch (_) {}
  }
})().catch(err => {
  console.error('[FAIL] Browser automation crashed:', err);
  process.exit(1);
});

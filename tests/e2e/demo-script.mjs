// End-to-end run of the client demo script (docs/demo-script.md).
// Usage: start the app (npm run build && npm start), then: node tests/e2e/demo-script.mjs
// Needs Playwright (preinstalled in many environments: npm i -D playwright && npx playwright install chromium).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("response", (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });

const step = (s) => console.log(`\n▶ ${s}`);
async function actAs(uid) {
  await ctx.addCookies([{ name: "uid", value: uid, url: BASE }]);
}
async function go(path) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
}
// Clicks a button and, for server actions, waits for the POST to finish.
async function press(locator, post = true) {
  const done = post ? page.waitForResponse((r) => r.request().method() === "POST", { timeout: 60000 }).catch(() => null) : null;
  await locator.click();
  if (done) await done;
  await page.waitForLoadState("networkidle");
}
async function click(text, opts = {}) {
  await press(page.getByRole("button", { name: text, exact: opts.exact ?? false }).first(), opts.post ?? true);
}
async function expectText(t) {
  await page.getByText(t, { exact: false }).first().waitFor({ timeout: 30000 });
  console.log(`  ✓ sees "${t}"`);
}

step("1 Dashboard");
await actAs("u-pod1");
await go("/");
await expectText("Pipeline funnel");

step("2 Submit through chat (quality manager)");
await actAs("u-req-quality");
await go("/submit");
for (let i = 0; i < 8; i++) {
  await click("Demo answer", { post: false });
  await click("Send", { exact: true });
  await page.waitForFunction((n) => document.querySelectorAll(".bg-brand.text-white.whitespace-pre-wrap, .whitespace-pre-wrap.bg-brand").length >= n, i + 1);
  await page.waitForTimeout(300);
}
await expectText("Check your problem summary");
await click("Confirm and submit");
await page.waitForURL(/\/requests\/.+tab=route/, { timeout: 60000 });
const reqUrl = page.url().split("?")[0];
const reqPath = reqUrl.replace(BASE, "");
console.log("  request:", reqPath);
await expectText("Similar requests and assets");

step("3 Sort and route (pod analyst): cluster + confirm route");
await actAs("u-pod1");
await go(`${reqPath}?tab=route`);
const sim = await page.locator("text=/Both are about/").count();
console.log(`  similar items with reasons: ${sim}`);
const members = await page.locator('input[name="members"]:checked').count();
console.log(`  pre-selected cluster members: ${members}`);
await click("Create cluster");
await expectText("This request is in cluster");
await page.selectOption("#route", "R5_CUSTOM_AI");
await click("Confirm route");
await expectText("Confirmed:");

step("4 Fast route example (R2)");
await go("/register?q=market+research");
await page.getByRole("link", { name: "Search our market research articles" }).click();
await page.waitForURL(/\/requests\//);
await expectText("Fast route");

step("5 Process map from the SOP document");
await go(`${reqPath}?tab=map`);
await click("Build process map");
await expectText("DOC-SOP-001");
await expectText("Source: DOC-SOP-001#");
await click("Mark as aligned");
await expectText("Aligned by");

step("6 Simulation: change one input, value updates, edit is logged");
await go(`${reqPath}?tab=value`);
await expectText("Range P10 – P90");
const before = await page.locator("text=Total benefit").locator("..").innerText();
const row = page.locator("form", { has: page.locator('input[name="key"][value="realizationFactor"]') });
await row.locator('input[name="value"]').fill("0.6");
await row.locator('input[name="reason"]').fill("Team lead confirms capacity is reused");
await press(row.getByRole("button", { name: "Save" }));
let after = before;
for (let i = 0; i < 40 && after === before; i++) {
  await page.waitForTimeout(250);
  after = await page.locator("text=Total benefit").locator("..").innerText();
}
console.log(`  before: ${before.replace(/\n/g, " ")}\n  after:  ${after.replace(/\n/g, " ")}`);
if (before === after) errors.push("Value did not change after edit");
const flags = await page.locator("text=/Quality checks \\(\\d+\\)/").innerText();
console.log(`  ${flags}`);
if (!/\(0\)/.test(flags)) {
  await page.locator('textarea[name="text"]').fill("Inputs come from the SOP and DMS cycle-time report. Pilot will confirm.");
  await click("Save justification");
}
await click("Value estimate done");
await go(`${reqPath}?tab=audit`);
await expectText("GENERAL.realizationFactor");

step("8 Design & cost (architect)");
await actAs("u-arch");
await go(`${reqPath}?tab=design`);
for (const [id, q] of [["build", "90"], ["csv", "20"], ["llm", "300"], ["vector", "1"], ["host", "1"], ["support", "0.5"]]) {
  const rows = await page.locator("table tbody tr").count();
  await page.selectOption('select[name="componentId"]', id);
  await page.fill('input[name="quantity"]', q);
  await click("Add cost");
  await page.waitForFunction((n) => document.querySelectorAll("table tbody tr").length > n, rows);
}
await expectText("year TCO");
await click("Draft architecture");
await expectText("Orchestrator agent");
await page.locator("svg").first().waitFor({ timeout: 20000 });
console.log("  ✓ Mermaid diagram rendered");
await click("Design and cost done");

step("9 Business case and slides (pod)");
await actAs("u-pod1");
await go(`${reqPath}?tab=case`);
await click("Generate business case");
await expectText("Key numbers");
for (const kind of ["pptx", "docx"]) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: kind === "pptx" ? "Council slides .pptx" : "Download .docx" }).click()]);
  const p = await dl.path();
  const { statSync } = await import("node:fs");
  console.log(`  ✓ ${kind} downloaded: ${dl.suggestedFilename()} (${statSync(p).size} bytes)`);
}

step("10 Approval: L3 because GxP, Finance first");
await go(`${reqPath}?tab=approvals`);
await click("Start approval workflow");
await page.locator("td", { hasText: /^Finance$/ }).first().waitFor({ timeout: 30000 });
console.log("  ✓ Finance step created");
await expectText("The process is GxP-regulated.");
await actAs("u-fin");
await go("/approvals");
await expectText("Finance review");
await press(page.locator("form", { has: page.locator(`input[value="${reqPath.split("/").pop()}"]`) }).getByRole("button", { name: "Approve", exact: true }).first());
await actAs("u-cm1");
await go("/council");
await expectText("Next meeting");
await press(page.locator("form", { has: page.locator(`input[value="${reqPath.split("/").pop()}"]`) }).getByRole("button", { name: "Approve as POC" }).first());
await actAs("u-chair");
await go("/council");
await page.locator("form", { has: page.locator(`input[value="${reqPath.split("/").pop()}"]`) }).locator('textarea[name="comment"]').fill("POC on two sites first.");
await press(page.locator("form", { has: page.locator(`input[value="${reqPath.split("/").pop()}"]`) }).getByRole("button", { name: "Approve as POC" }).first());
await go(`${reqPath}?tab=approvals`);
await expectText("Approved as POC");
await go("/outbox?all=1");
await expectText("[Decision]");

step("7 Flags on the inflated ROI request");
await go("/register?q=Pricing");
await page.getByRole("link", { name: /Pricing calculator/ }).click();
await page.waitForURL(/\/requests\//);
await go(page.url().replace(BASE, "").split("?")[0] + "?tab=value");
for (const f of ["ROI too high", "Exceeds current spend", "Headcount implied"]) await expectText(f);

step("11 Marketplace, 12 Value dashboard, cluster view, admin");
await go("/marketplace");
await expectText("Certified");
await go("/value");
await expectText("Estimate accuracy by AI pattern");
await go("/register?view=clusters");
await expectText("SOP review");
await actAs("u-admin");
await go("/admin?tab=benchmarks");
await expectText("Time reduction ranges");

await browser.close();
if (errors.length) {
  console.error("\n✗ Errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("\n✓ Demo script passed");

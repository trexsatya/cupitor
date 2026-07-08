// Browser-driven filmot fetching. filmot fingerprints plain HTTP clients and
// shows an hCaptcha wall, so we drive a real Chromium via Playwright and inject
// your already-logged-in filmot session cookie (so no sign-in is needed inside
// the automated window — Google blocks OAuth there anyway). Playwright is an
// optional dependency, only browser mode needs it:
//   npm i playwright && npx playwright install chromium
import { mkdirSync } from "node:fs";

async function getChromium() {
  try {
    const pw = await import("playwright");
    return pw.chromium;
  } catch (e) {
    throw new Error(
      "Browser mode needs Playwright. Install it once:\n" +
        "  npm i playwright && npx playwright install chromium"
    );
  }
}

// Parse a raw Cookie header ("a=1; b=2") into Playwright cookie objects scoped to
// filmot.com. Values are kept verbatim (already URL-encoded as the server expects).
function parseCookieHeader(header) {
  return String(header || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf("=");
      if (i < 0) return null;
      return { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim(), url: "https://filmot.com" };
    })
    .filter((c) => c && c.name);
}

// Open a persistent filmot browser session. Returns { getPage(url), close() }.
// `cookie` (your logged-in filmot Cookie header) is injected; `userAgent` should
// match the browser that cookie was minted in (filmot binds the session to it).
export async function openFilmotSession({ userDataDir, headless = false, delayMs = 1500, cookie = "", userAgent } = {}) {
  const chromium = await getChromium();
  mkdirSync(userDataDir, { recursive: true });
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    viewport: { width: 1280, height: 900 },
    // Drop the most obvious automation tell so filmot's bot check is less likely
    // to fire even though we're driving the browser.
    args: ["--disable-blink-features=AutomationControlled"],
    ...(userAgent ? { userAgent } : {}),
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  if (cookie) {
    try {
      await context.addCookies(parseCookieHeader(cookie));
    } catch (e) {
      console.warn("  (could not inject filmotCookie:", e.message, ")");
    }
  }
  const page = context.pages()[0] || (await context.newPage());

  const getPage = async (url) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (delayMs) await page.waitForTimeout(delayMs); // let filmot JS populate
    return await page.content();
  };

  return { getPage, close: () => context.close() };
}

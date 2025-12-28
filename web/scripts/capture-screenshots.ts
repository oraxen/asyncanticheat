/**
 * Screenshot capture script for AsyncAnticheat documentation
 * 
 * Usage:
 *   bun run scripts/capture-screenshots.ts
 * 
 * The script will:
 *   1. Read dev credentials from secrets.json
 *   2. Auto-login using magic link or credentials
 *   3. Capture all dashboard screenshots
 *   4. Save them as WebP (95% quality) to public/docs/
 * 
 * Environment variables:
 *   DASHBOARD_URL - Override the dashboard URL (default: https://asyncanticheat.com)
 *   DEV_EMAIL - Override login email
 *   DEV_PASS - Override login password
 */

import puppeteer, { type Page, type Browser } from "puppeteer";
import { mkdir, readFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";

const BASE_URL = process.env.DASHBOARD_URL || "https://asyncanticheat.com";
const OUTPUT_DIR = join(import.meta.dir, "../public/docs");
const SECRETS_PATH = join(import.meta.dir, "../../../secrets.json");
const WEBP_QUALITY = 98;

interface Screenshot {
  name: string;
  path: string;
  description: string;
  waitFor?: string;
  actions?: (page: Page) => Promise<void>;
}

const screenshots: Screenshot[] = [
  // Dashboard Overview
  {
    name: "dashboard-overview",
    path: "/dashboard",
    description: "Main dashboard overview with global monitor",
    waitFor: "Global Monitor",
  },

  // Players Page
  {
    name: "players-list",
    path: "/dashboard/players",
    description: "Players page showing recent player sessions",
    waitFor: "Players",
  },
  {
    name: "players-detail",
    path: "/dashboard/players",
    description: "Player detail sidebar with session history",
    waitFor: "Players",
    actions: async (page) => {
      await page.evaluate(() => {
        const btn = document.querySelector('button[class*="group"]') as HTMLElement;
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 800));
    },
  },
  {
    name: "players-report-cheat",
    path: "/dashboard/players",
    description: "Report undetected cheat dialog",
    waitFor: "Players",
    actions: async (page) => {
      // Click first player to select them
      await page.evaluate(() => {
        const btn = document.querySelector('button[class*="group"]') as HTMLElement;
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 800));
      // Click the "Report undetected cheat" button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const reportBtn = buttons.find((b) =>
          b.textContent?.toLowerCase().includes("report") &&
          b.textContent?.toLowerCase().includes("cheat")
        );
        if (reportBtn) reportBtn.click();
      });
      await new Promise((r) => setTimeout(r, 600));
    },
  },

  // Findings Page
  {
    name: "findings-list",
    path: "/dashboard/findings",
    description: "Findings page showing detected violations",
    waitFor: "Findings",
  },
  {
    name: "findings-detail",
    path: "/dashboard/findings",
    description: "Finding detail with player history",
    waitFor: "Findings",
    actions: async (page) => {
      await page.evaluate(() => {
        const btn = document.querySelector('button[class*="group"]') as HTMLElement;
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 800));
    },
  },
  {
    name: "findings-report-false-positive",
    path: "/dashboard/findings",
    description: "Report false positive dialog",
    waitFor: "Findings",
    actions: async (page) => {
      // Click first finding to select it
      await page.evaluate(() => {
        const btn = document.querySelector('button[class*="group"]') as HTMLElement;
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 800));
      // Click the "Report as false positive" button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const reportBtn = buttons.find((b) =>
          b.textContent?.toLowerCase().includes("false positive")
        );
        if (reportBtn) reportBtn.click();
      });
      await new Promise((r) => setTimeout(r, 600));
    },
  },

  // Modules Page
  {
    name: "modules-list",
    path: "/dashboard/modules",
    description: "Modules page showing all detection modules",
    waitFor: "Modules",
  },
  {
    name: "modules-detail",
    path: "/dashboard/modules",
    description: "Module detail with checks",
    waitFor: "Modules",
    actions: async (page) => {
      await page.evaluate(() => {
        const btn = document.querySelector('button[class*="group"]') as HTMLElement;
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 800));
    },
  },

  // Settings Page
  {
    name: "settings",
    path: "/dashboard/settings",
    description: "Server settings and configuration",
    waitFor: "Settings",
  },
];

async function getCredentials(): Promise<{ email: string; pass: string } | null> {
  // Check environment variables first
  if (process.env.DEV_EMAIL && process.env.DEV_PASS) {
    return { email: process.env.DEV_EMAIL, pass: process.env.DEV_PASS };
  }

  // Read from secrets.json
  try {
    const secrets = JSON.parse(await readFile(SECRETS_PATH, "utf-8"));
    const devUser = secrets.projects?.asyncanticheat?.website?.dev_user;
    if (devUser?.email && devUser?.pass) {
      return { email: devUser.email, pass: devUser.pass };
    }
  } catch {
    // Secrets file not found or invalid
  }

  return null;
}

async function loginWithCredentials(page: Page, email: string, password: string): Promise<boolean> {
  console.log(`🔐 Logging in as ${email}...`);

  try {
    // Wait for login page to load
    await page.waitForSelector('input[type="email"], input[placeholder*="email"]', { timeout: 10000 });

    // Find and fill email input
    const emailInput = await page.$('input[type="email"], input[placeholder*="email"]');
    if (emailInput) {
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(email, { delay: 50 });
    }

    // Wait for the login form to check if password is needed
    // The form does an async check when email is entered
    console.log("   Waiting for password field...");
    await new Promise((r) => setTimeout(r, 2000));

    // Check if password field appeared
    const passwordInput = await page.$('input[type="password"]');
    
    if (passwordInput) {
      console.log("   Password field detected, entering password...");
      await passwordInput.click();
      await passwordInput.type(password, { delay: 30 });
      
      // Small delay then submit
      await new Promise((r) => setTimeout(r, 300));
      
      // Click the sign in button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button[type="submit"]'));
        const signInBtn = buttons.find(btn => 
          btn.textContent?.toLowerCase().includes('sign in')
        );
        if (signInBtn) {
          (signInBtn as HTMLButtonElement).click();
        }
      });
      
      console.log("   Submitted login form...");
    } else {
      console.log("   No password field - using magic link...");
      // Click magic link button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button[type="submit"]'));
        const btn = buttons.find(b => b.textContent?.toLowerCase().includes('magic'));
        if (btn) (btn as HTMLButtonElement).click();
      });
      console.log("📧 Magic link requested! Check your email...");
    }

    // Wait for navigation away from login
    await page.waitForFunction(
      () => !window.location.pathname.includes("/login"),
      { timeout: 30000 }
    );

    return true;
  } catch (error) {
    console.log(`⚠️  Auto-login failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    return false;
  }
}

async function waitForDashboard(page: Page): Promise<void> {
  const maxWait = 5 * 60 * 1000; // 5 minutes
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const url = page.url();
    
    if (url.includes("/dashboard") && !url.includes("/login")) {
      try {
        await page.waitForSelector("nav", { timeout: 2000 });
        return;
      } catch {
        // Keep waiting
      }
    }
    
    await new Promise((r) => setTimeout(r, 1000));
  }
  
  throw new Error("Timeout waiting for dashboard");
}

async function captureScreenshots(): Promise<void> {
  console.log("📸 AsyncAnticheat Documentation Screenshot Capture\n");
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log(`🌐 URL: ${BASE_URL}\n`);

  await mkdir(OUTPUT_DIR, { recursive: true });

  const credentials = await getCredentials();
  if (credentials) {
    console.log(`👤 Found dev credentials for: ${credentials.email}\n`);
  } else {
    console.log("⚠️  No credentials found in secrets.json - manual login required\n");
  }

  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1440, height: 900 },
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Navigate to dashboard
    console.log("🌐 Navigating to dashboard...");
    await page.goto(`${BASE_URL}/dashboard`, { 
      waitUntil: "networkidle2",
      timeout: 60000 
    });

    // Check if login required
    if (page.url().includes("/login")) {
      let loggedIn = false;

      if (credentials) {
        loggedIn = await loginWithCredentials(page, credentials.email, credentials.pass);
      }

      if (!loggedIn) {
        console.log("\n━".repeat(50));
        console.log("👆 Please log in using the browser window above");
        console.log("   The script will continue automatically after login");
        console.log("━".repeat(50) + "\n");
      }
    }

    // Wait for dashboard to load
    await waitForDashboard(page);
    console.log("✅ Dashboard loaded!\n");

    // Small delay for UI to settle
    await new Promise((r) => setTimeout(r, 2000));

    // Capture each screenshot
    let captured = 0;
    for (const screenshot of screenshots) {
      process.stdout.write(`📷 ${screenshot.name}... `);

      try {
        await page.goto(`${BASE_URL}${screenshot.path}`, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });

        // Wait for page content
        if (screenshot.waitFor) {
          await page.waitForFunction(
            (text) => document.body.innerText.includes(text),
            { timeout: 10000 },
            screenshot.waitFor
          );
        }

        // Let animations settle
        await new Promise((r) => setTimeout(r, 1500));

        // Execute custom actions
        if (screenshot.actions) {
          await screenshot.actions(page);
        }

        // Take screenshot as PNG buffer, then convert to WebP
        const pngBuffer = await page.screenshot({ encoding: "binary" });
        const outputPath = join(OUTPUT_DIR, `${screenshot.name}.webp`);
        
        await sharp(pngBuffer)
          .webp({ quality: WEBP_QUALITY })
          .toFile(outputPath);
        
        console.log("✅");
        captured++;
      } catch (error) {
        console.log(`❌ ${error instanceof Error ? error.message : "Failed"}`);
      }
    }

    console.log(`\n🎉 Done! Captured ${captured}/${screenshots.length} screenshots`);
    console.log(`📁 Saved to: ${OUTPUT_DIR}`);

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

captureScreenshots().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});

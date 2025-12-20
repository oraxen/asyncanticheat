/**
 * Screenshot capture script for AsyncAnticheat documentation
 * 
 * Usage:
 *   bun run scripts/capture-screenshots.ts
 * 
 * Prerequisites:
 *   - bun add -D puppeteer
 *   - You must be logged in to the dashboard in your browser
 *   - The dashboard must be running locally or use the production URL
 */

import puppeteer from "puppeteer";
import { mkdir } from "fs/promises";
import { join } from "path";

const BASE_URL = process.env.DASHBOARD_URL || "https://asyncanticheat.com";
const OUTPUT_DIR = join(import.meta.dir, "../docs-screenshots");

interface Screenshot {
  name: string;
  path: string;
  description: string;
  actions?: (page: puppeteer.Page) => Promise<void>;
  waitFor?: string;
  fullPage?: boolean;
  clip?: { x: number; y: number; width: number; height: number };
}

const screenshots: Screenshot[] = [
  // Dashboard Overview
  {
    name: "dashboard-overview",
    path: "/dashboard",
    description: "Main dashboard overview with global monitor",
    waitFor: "Global Monitor",
  },
  {
    name: "dashboard-connection-status",
    path: "/dashboard",
    description: "Connection status panel showing API and plugin connectivity",
    waitFor: "Connection Status",
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
      // Click the first player card to open details
      await page.waitForSelector('button[class*="group"]');
      await page.click('button[class*="group"]');
      await new Promise((r) => setTimeout(r, 500));
    },
  },
  {
    name: "players-report-cheat",
    path: "/dashboard/players",
    description: "Report undetected cheat dialog",
    waitFor: "Players",
    actions: async (page) => {
      await page.waitForSelector('button[class*="group"]');
      await page.click('button[class*="group"]');
      await new Promise((r) => setTimeout(r, 500));
      // Look for "Report undetected cheat" button
      const reportBtn = await page.$('button:has-text("Report")');
      if (reportBtn) {
        await reportBtn.click();
        await new Promise((r) => setTimeout(r, 500));
      }
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
      // Click a finding to view details
      await page.waitForSelector('button[class*="group"]');
      const buttons = await page.$$('button[class*="group"]');
      if (buttons.length > 0) {
        await buttons[0].click();
        await new Promise((r) => setTimeout(r, 500));
      }
    },
  },
  {
    name: "findings-report-false-positive",
    path: "/dashboard/findings",
    description: "Report false positive dialog",
    waitFor: "Findings",
    actions: async (page) => {
      // Click the flag icon to report false positive
      await page.waitForSelector('[class*="RiFlagLine"], button[title*="false positive"]');
      const flagBtn = await page.$('[class*="RiFlagLine"]');
      if (flagBtn) {
        await flagBtn.click();
        await new Promise((r) => setTimeout(r, 500));
      }
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
    description: "Module detail with checks and configuration",
    waitFor: "Modules",
    actions: async (page) => {
      await page.waitForSelector('button[class*="group"]');
      const buttons = await page.$$('button[class*="group"]');
      if (buttons.length > 0) {
        await buttons[0].click();
        await new Promise((r) => setTimeout(r, 500));
      }
    },
  },

  // Settings Page
  {
    name: "settings",
    path: "/dashboard/settings",
    description: "Server settings and configuration",
    waitFor: "Settings",
  },

  // Register Server Flow
  {
    name: "register-server",
    path: "/register-server",
    description: "Server registration page",
    waitFor: "Register",
  },
];

async function captureScreenshots() {
  console.log("📸 Starting screenshot capture...\n");

  // Create output directory
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`📁 Output directory: ${OUTPUT_DIR}\n`);

  // Launch browser with user data to preserve auth session
  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI
    defaultViewport: { width: 1512, height: 982 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  const page = await browser.newPage();

  // Set a realistic user agent
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  console.log("🔐 Please log in to the dashboard in the browser window...");
  console.log("   The script will wait for you to complete login.\n");

  // Navigate to dashboard and wait for login
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle2" });

  // Check if we're on login page
  const isLoginPage = await page.evaluate(() => {
    return window.location.pathname === "/login";
  });

  if (isLoginPage) {
    console.log("⏳ Waiting for login... (complete login in the browser)");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 300000 });
  }

  // Wait for dashboard to load
  await page.waitForSelector("text=Global Monitor", { timeout: 30000 });
  console.log("✅ Logged in successfully!\n");

  // Capture each screenshot
  for (const screenshot of screenshots) {
    console.log(`📷 Capturing: ${screenshot.name}`);
    console.log(`   Path: ${screenshot.path}`);

    try {
      // Navigate to the page
      await page.goto(`${BASE_URL}${screenshot.path}`, {
        waitUntil: "networkidle2",
      });

      // Wait for specific element if specified
      if (screenshot.waitFor) {
        await page.waitForSelector(`text=${screenshot.waitFor}`, {
          timeout: 10000,
        });
      }

      // Allow page to settle
      await new Promise((r) => setTimeout(r, 1000));

      // Execute custom actions if any
      if (screenshot.actions) {
        await screenshot.actions(page);
        await new Promise((r) => setTimeout(r, 500));
      }

      // Take screenshot
      const outputPath = join(OUTPUT_DIR, `${screenshot.name}.png`);
      await page.screenshot({
        path: outputPath,
        fullPage: screenshot.fullPage ?? false,
        clip: screenshot.clip,
      });

      console.log(`   ✅ Saved: ${outputPath}\n`);
    } catch (error) {
      console.log(`   ❌ Failed: ${error}\n`);
    }
  }

  await browser.close();

  console.log("\n🎉 Screenshot capture complete!");
  console.log(`📁 Screenshots saved to: ${OUTPUT_DIR}`);
}

captureScreenshots().catch(console.error);

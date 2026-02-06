import { chromium, type Browser, type Page } from "playwright";
import type { TestAppLauncher } from "./test-app-launcher";
import type { ThirdpartyServices, AnalyticsEventRow } from "./thirdparty-services";

export type RouterType = "app" | "pages";

/**
 * Test helper for a specific router type (app or pages).
 * Provides browser automation and database verification helpers.
 */
export class TestApp {
  private launcher: TestAppLauncher;
  private services: ThirdpartyServices;
  private routerType: RouterType;
  private browser: Browser | null = null;

  constructor(launcher: TestAppLauncher, services: ThirdpartyServices, routerType: RouterType) {
    this.launcher = launcher;
    this.services = services;
    this.routerType = routerType;
  }

  get baseUrl(): string {
    return this.launcher.baseUrl;
  }

  get homePath(): string {
    return this.routerType === "app" ? "/" : "/pages-home";
  }

  get testPagePath(): string {
    return this.routerType === "app" ? "/test-page" : "/pages-test";
  }

  get loginPath(): string {
    return "/api/auth/signin";
  }

  // Browser helpers
  async openBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
    return this.browser;
  }

  async newPage(): Promise<Page> {
    const browser = await this.openBrowser();
    const context = await browser.newContext();
    return context.newPage();
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // Database helpers (delegate to services)
  async clearAnalytics(): Promise<void> {
    await this.services.clearAnalytics();
  }

  async getAnalyticsEvents(): Promise<AnalyticsEventRow[]> {
    return this.services.getAnalyticsEvents();
  }

  async getAnalyticsEventsByPath(path: string): Promise<AnalyticsEventRow[]> {
    return this.services.getAnalyticsEventsByPath(path);
  }

  /** Poll until at least `minCount` events match the predicate, or timeout */
  async waitForEvents(
    predicate: (events: AnalyticsEventRow[]) => boolean,
    { timeout = 5000, interval = 100 } = {}
  ): Promise<AnalyticsEventRow[]> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const events = await this.getAnalyticsEvents();
      if (predicate(events)) return events;
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error(`Timed out waiting for analytics events after ${timeout}ms`);
  }

  // Test action helpers
  async login(page: Page): Promise<void> {
    await page.goto(`${this.baseUrl}${this.loginPath}`);
    // next-auth's built-in signin page uses name attributes
    await page.fill('input[name="username"]', "testuser");
    await page.fill('input[name="password"]', "testpass");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/signin"));
  }

  async visitHome(page: Page): Promise<void> {
    await page.goto(`${this.baseUrl}${this.homePath}`);
    await page.waitForLoadState("networkidle");
  }

  async visitTestPage(page: Page): Promise<void> {
    await page.goto(`${this.baseUrl}${this.testPagePath}`);
    await page.waitForLoadState("networkidle");
  }
}

// Re-export for convenience
export type { AnalyticsEventRow } from "./thirdparty-services";

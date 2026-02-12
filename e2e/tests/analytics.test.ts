import { describe, beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import { ThirdpartyServices } from "./thirdparty-services";
import { TestAppLauncher, type NextVersion } from "./test-app-launcher";
import { TestApp, type RouterType } from "./test-app";

const services = new ThirdpartyServices();
const envVersion = process.env.NEXT_E2E_VERSION as NextVersion | undefined;
const envRouter = process.env.NEXT_E2E_ROUTER as RouterType | undefined;
const versions: NextVersion[] = envVersion ? [envVersion] : ["next15", "next16"];
const routers: RouterType[] = envRouter ? [envRouter] : ["app", "pages"];

beforeAll(async () => {
  if (process.env.NEXT_E2E_SKIP_SERVICES !== "true") {
    await services.start();
  }
}, 60000);

afterAll(async () => {
  await services.stop();
});

describe.each(versions)("%s", (version) => {
  let launcher: TestAppLauncher;

  beforeAll(async () => {
    launcher = new TestAppLauncher(version, services);
    await launcher.install();
    await launcher.build();
    await launcher.start();
  }, 180000);

  afterAll(async () => {
    await launcher.stop();
  });

  describe.each(routers)("%s router", (routerType) => {
    let testApp: TestApp;

    beforeAll(() => {
      testApp = new TestApp(launcher, services, routerType);
    });

    afterAll(async () => {
      await testApp.closeBrowser();
    });

    beforeEach(async () => {
      if (process.env.NEXT_E2E_SKIP_SERVICES !== "true") {
        await testApp.clearAnalytics();
      }
    });

    it("tracks page view for anonymous user", async () => {
      const page = await testApp.newPage();

      await testApp.visitHome(page);

      await page.waitForTimeout(300);
      const events = await testApp.getAnalyticsEvents();

      const pageViewEvent = events.find(
        (e) => e.type === "pageView" && e.path === testApp.homePath
      );
      expect(pageViewEvent).toBeDefined();
      expect(pageViewEvent!.anonymous_user_id).toBeTruthy();
      expect(pageViewEvent!.user_id).toBeNull();

      await page.close();
    });

    it("tracks page view with user identity after login", async () => {
      const page = await testApp.newPage();

      await testApp.login(page);
      await testApp.visitHome(page);

      const userStatus = await page.textContent('[data-testid="user-status"]');
      expect(userStatus).toContain("Test User");

      await page.waitForTimeout(300);
      const events = await testApp.getAnalyticsEvents();
      const authenticatedEvents = events.filter((e) => e.user_id === "test-user-id");

      expect(authenticatedEvents.length).toBeGreaterThanOrEqual(1);
      expect(authenticatedEvents[0].user_email).toBe("test@example.com");
      expect(authenticatedEvents[0].user_name).toBe("Test User");

      await page.close();
    });

    it("tracks navigation between pages", async () => {
      const page = await testApp.newPage();

      await testApp.visitHome(page);
      await page.click('[data-testid="test-page-link"]');
      await page.waitForLoadState("networkidle");

      await page.waitForTimeout(300);
      const events = await testApp.getAnalyticsEvents();
      const pageViews = events.filter((e) => e.type === "pageView");
      console.log(
        "[e2e][pageViews]",
        pageViews.map((e) => ({
          path: e.path,
          type: e.type,
          event_id: e.event_id,
          parent_event_id: e.parent_event_id,
        }))
      );

      expect(pageViews.length).toBe(2);
      const paths = pageViews.map((e) => e.path);
      expect(paths).toContain(testApp.homePath);
      expect(paths).toContain(testApp.testPagePath);

      await page.close();
    });

    it("captures server context (host, method, user-agent)", async () => {
      const page = await testApp.newPage();

      await testApp.visitHome(page);

      await page.waitForTimeout(300);
      const events = await testApp.getAnalyticsEvents();
      const pageViewEvent = events.find(
        (e) => e.type === "pageView" && e.path === testApp.homePath
      );

      expect(pageViewEvent).toBeDefined();
      expect(pageViewEvent!.host).toContain("localhost");
      expect(pageViewEvent!.method).toBe("GET");
      expect(pageViewEvent!.user_agent).toBeTruthy();

      await page.close();
    });

    it("maintains consistent anonymous user ID across page views", async () => {
      const page = await testApp.newPage();

      await testApp.visitHome(page);
      await testApp.visitTestPage(page);

      await page.waitForTimeout(300);
      const events = await testApp.getAnalyticsEvents();
      const pageViews = events.filter((e) => e.type === "pageView");

      expect(pageViews.length).toBe(2);
      const anonIds = new Set(pageViews.map((e) => e.anonymous_user_id));
      expect(anonIds.size).toBe(1);

      await page.close();
    });

    it("on-client-event backend receives events with full client context", async () => {
      const page = await testApp.newPage();

      await testApp.visitHome(page);

      // Wait for events in both backends
      await page.waitForTimeout(500);
      const [immediateEvents, delayedEvents] = await Promise.all([
        testApp.getAnalyticsEvents(),
        testApp.getDelayedAnalyticsEvents(),
      ]);

      const immediatePageView = immediateEvents.find(
        (e) => e.type === "pageView" && e.path === testApp.homePath
      );
      const delayedPageView = delayedEvents.find(
        (e) => e.type === "pageView" && e.path === testApp.homePath
      );

      expect(immediatePageView).toBeDefined();
      expect(delayedPageView).toBeDefined();

      // Both should have the same event_id
      expect(delayedPageView!.event_id).toBe(immediatePageView!.event_id);

      // Delayed backend should have client_context with screen info
      const delayedClientCtx = delayedPageView!.client_context as Record<string, unknown>;
      expect(delayedClientCtx).toBeDefined();
      expect(delayedClientCtx.screen).toBeDefined();

      const screen = delayedClientCtx.screen as Record<string, unknown>;
      expect(screen.width).toBeGreaterThan(0);
      expect(screen.height).toBeGreaterThan(0);
      expect(screen.innerWidth).toBeGreaterThan(0);
      expect(screen.innerHeight).toBeGreaterThan(0);

      // Delayed backend should have title (from document.title)
      expect(delayedClientCtx.title).toBeDefined();

      await page.close();
    });

    it("script modes work correctly during soft navigation", async () => {
      // This test only applies to App Router (soft navigation with <Link>)
      if (routerType !== "app") return;

      const page = await testApp.newPage();

      // Visit home page
      await testApp.visitHome(page);
      await page.waitForLoadState("networkidle");

      // Wait for initial scripts to execute
      await page.waitForFunction(() => window.__nextlyticsTestInit !== undefined);

      // Get initial counters
      const initialCounters = await page.evaluate(() => ({
        init: window.__nextlyticsTestInit,
        config: window.__nextlyticsTestConfig,
        event: window.__nextlyticsTestEvent,
      }));

      expect(initialCounters.init).toBe(1);
      expect(initialCounters.config).toBe(1);
      expect(initialCounters.event).toBe(1);

      // Here's why double wait, first is to make sure /api/event was started (it's async
      // second, wait until /api/event is done and give some time to inject scripts 
      await page.click('[data-testid="test-page-link"]');
      await page.waitForTimeout(100);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(200);

      // Get counters after soft navigation
      const afterNavCounters = await page.evaluate(() => ({
        init: window.__nextlyticsTestInit,
        config: window.__nextlyticsTestConfig,
        event: window.__nextlyticsTestEvent,
      }));

      // init should still be 1 - not re-executed
      expect(afterNavCounters.init).toBe(1);
      // config should be 2 - path changed from "/" to "/test-page"
      expect(afterNavCounters.config).toBe(2);
      // event should be 2 - runs on every navigation
      expect(afterNavCounters.event).toBe(2);

      // Navigate back to home. Double wait pattern - see above
      await page.click('[data-testid="home-link"]');
      await page.waitForTimeout(100);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(200);

      // Get final counters
      const finalCounters = await page.evaluate(() => ({
        init: window.__nextlyticsTestInit,
        config: window.__nextlyticsTestConfig,
        event: window.__nextlyticsTestEvent,
      }));

      // init should still be 1
      expect(finalCounters.init).toBe(1);
      // config should still be 2 (same deps key should not re-run)
      expect(finalCounters.config).toBe(2);
      // event should be 3
      expect(finalCounters.event).toBe(3);

      await page.close();
    });
  });
});

// Type augmentation for test globals
declare global {
  interface Window {
    __nextlyticsTestOnce?: number;
    __nextlyticsTestParamsChange?: number;
    __nextlyticsTestEveryRender?: number;
  }
}

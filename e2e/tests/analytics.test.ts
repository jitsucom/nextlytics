import { describe, beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import { ThirdpartyServices } from "./thirdparty-services";
import { TestAppLauncher, type NextVersion } from "./test-app-launcher";
import { TestApp, type RouterType } from "./test-app";

const services = new ThirdpartyServices();
const versions: NextVersion[] = ["next15", "next16"];
const routers: RouterType[] = ["app", "pages"];

beforeAll(async () => {
  await services.start();
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
      await testApp.clearAnalytics();
    });

    it("tracks page view for anonymous user", async () => {
      const page = await testApp.newPage();

      await testApp.visitHome(page);

      const events = await testApp.waitForEvents((e) =>
        e.some((ev) => ev.type === "pageView" && ev.path === testApp.homePath)
      );

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

      const events = await testApp.waitForEvents((e) =>
        e.some((ev) => ev.user_id === "test-user-id")
      );
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

      const events = await testApp.waitForEvents(
        (e) => e.filter((ev) => ev.type === "pageView").length >= 2
      );
      const pageViews = events.filter((e) => e.type === "pageView");

      const paths = pageViews.map((e) => e.path);
      expect(paths).toContain(testApp.homePath);
      expect(paths).toContain(testApp.testPagePath);

      await page.close();
    });

    it("captures server context (host, method, user-agent)", async () => {
      const page = await testApp.newPage();

      await testApp.visitHome(page);

      const events = await testApp.waitForEvents((e) =>
        e.some((ev) => ev.type === "pageView" && ev.path === testApp.homePath)
      );
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

      const events = await testApp.waitForEvents(
        (e) => e.filter((ev) => ev.type === "pageView").length >= 2
      );
      const pageViews = events.filter((e) => e.type === "pageView");

      const anonIds = new Set(pageViews.map((e) => e.anonymous_user_id));
      expect(anonIds.size).toBe(1);

      await page.close();
    });

    it("on-client-event backend receives events with full client context", async () => {
      const page = await testApp.newPage();

      await testApp.visitHome(page);

      // Wait for events in both backends
      const [immediateEvents, delayedEvents] = await Promise.all([
        testApp.waitForEvents((e) =>
          e.some((ev) => ev.type === "pageView" && ev.path === testApp.homePath)
        ),
        testApp.waitForDelayedEvents((e) =>
          e.some((ev) => ev.type === "pageView" && ev.path === testApp.homePath)
        ),
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
  });
});

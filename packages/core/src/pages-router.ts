import type { NextlyticsContext } from "./client";
import { restoreServerComponentContext } from "./server-component-context";

type ContextWithHeaders = { req: { headers: Record<string, string | string[] | undefined> } };

/**
 * Extract Nextlytics context from Pages Router context (getServerSideProps or getInitialProps).
 * Use this in _app.tsx with getInitialProps to pass context to NextlyticsClient.
 *
 * @example
 * ```tsx
 * // pages/_app.tsx
 * import type { AppContext, AppProps } from 'next/app'
 * import { NextlyticsClient, getNextlyticsProps, type NextlyticsContext } from '@nextlytics/core'
 *
 * type MyAppProps = AppProps & { nextlyticsCtx: NextlyticsContext }
 *
 * function MyApp({ Component, pageProps, nextlyticsCtx }: MyAppProps) {
 *   return (
 *     <NextlyticsClient ctx={nextlyticsCtx}>
 *       <Component {...pageProps} />
 *     </NextlyticsClient>
 *   )
 * }
 *
 * MyApp.getInitialProps = async (appContext: AppContext) => {
 *   return {
 *     pageProps: appContext.Component.getInitialProps
 *       ? await appContext.Component.getInitialProps(appContext.ctx)
 *       : {},
 *     nextlyticsCtx: getNextlyticsProps(appContext.ctx),
 *   }
 * }
 * ```
 */
export function getNextlyticsProps(ctx: ContextWithHeaders): NextlyticsContext {
  const headersList = new Headers();
  for (const [key, value] of Object.entries(ctx.req.headers)) {
    if (value) {
      headersList.set(key, Array.isArray(value) ? value[0] : value);
    }
  }

  const context = restoreServerComponentContext(headersList);
  if (!context) {
    return { requestId: "" };
  }

  return {
    requestId: context.pageRenderId,
    scripts: context.scripts,
    templates: context.templates,
  };
}

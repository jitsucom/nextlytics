import type { AppContext, AppProps } from "next/app";
import { NextlyticsClient, type NextlyticsContext } from "@nextlytics/core/client";
import { getNextlyticsProps } from "@nextlytics/core";
import { SessionProvider } from "next-auth/react";

type MyAppProps = AppProps & { nextlyticsCtx: NextlyticsContext };

function MyApp({ Component, pageProps, nextlyticsCtx }: MyAppProps) {
  return (
    <SessionProvider>
      <NextlyticsClient ctx={nextlyticsCtx}>
        <Component {...pageProps} />
      </NextlyticsClient>
    </SessionProvider>
  );
}

MyApp.getInitialProps = async (appContext: AppContext) => {
  const { ctx } = appContext;

  // getInitialProps re-runs in the browser on client-side navigation, where
  // there is no `ctx.req`. getNextlyticsProps handles that and returns an empty
  // context; the client keeps the templates and scripts it already has.
  return {
    pageProps: appContext.Component.getInitialProps
      ? await appContext.Component.getInitialProps(ctx)
      : {},
    nextlyticsCtx: getNextlyticsProps(ctx),
  };
};

export default MyApp;

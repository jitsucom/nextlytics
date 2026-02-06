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

  // Only get nextlytics props on server-side (when req is available)
  const nextlyticsCtx: NextlyticsContext = ctx.req
    ? getNextlyticsProps({ req: { headers: ctx.req.headers } })
    : { requestId: "" };

  return {
    pageProps: appContext.Component.getInitialProps
      ? await appContext.Component.getInitialProps(ctx)
      : {},
    nextlyticsCtx,
  };
};

export default MyApp;

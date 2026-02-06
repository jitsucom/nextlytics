import { middleware } from "./nextlytics";

export { middleware };

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

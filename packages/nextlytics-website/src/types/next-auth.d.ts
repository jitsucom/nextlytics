import "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    provider?: string;
  }

  interface Session {
    user: User & {
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    provider?: string;
    accessToken?: string;
  }
}

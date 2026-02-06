import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const expectedUsername = process.env.TEST_USER_USERNAME || "testuser";
        const expectedPassword = process.env.TEST_USER_PASSWORD || "testpass";

        if (
          credentials?.username === expectedUsername &&
          credentials?.password === expectedPassword
        ) {
          return {
            id: "test-user-id",
            name: "Test User",
            email: "test@example.com",
          };
        }
        return null;
      },
    }),
  ],
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});

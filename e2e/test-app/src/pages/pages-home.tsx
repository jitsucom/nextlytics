import { useSession } from "next-auth/react";
import Link from "next/link";

export default function PagesHome() {
  const { data: session } = useSession();

  return (
    <main>
      <h1>Pages Router Home</h1>
      <p data-testid="router-type">Router: Pages</p>
      {session?.user ? (
        <div>
          <p data-testid="user-status">Logged in as: {session.user.name}</p>
          <a href="/api/auth/signout" data-testid="logout-button">
            Sign Out
          </a>
        </div>
      ) : (
        <div>
          <p data-testid="user-status">Not logged in</p>
          <a href="/api/auth/signin" data-testid="login-link">
            Login
          </a>
        </div>
      )}
      <nav>
        <Link href="/pages-test" data-testid="test-page-link">
          Test Page
        </Link>
      </nav>
    </main>
  );
}

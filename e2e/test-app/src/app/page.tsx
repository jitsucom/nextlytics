import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main>
      <h1>App Router Home</h1>
      <p data-testid="router-type">Router: App</p>
      {session ? (
        <div>
          <p data-testid="user-status">Logged in as: {session.user?.name}</p>
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
        <a href="/test-page" data-testid="test-page-link">
          Test Page
        </a>
      </nav>
    </main>
  );
}

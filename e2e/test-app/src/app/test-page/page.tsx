import Link from "next/link";

export default function TestPage() {
  return (
    <main>
      <h1>App Router Test Page</h1>
      <p data-testid="page-marker">This is a test page for App Router</p>
      <nav>
        <Link href="/" data-testid="home-link">
          Back to Home
        </Link>
      </nav>
    </main>
  );
}

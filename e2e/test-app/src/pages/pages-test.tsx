import Link from "next/link";

export default function PagesTestPage() {
  return (
    <main>
      <h1>Pages Router Test Page</h1>
      <p data-testid="page-marker">This is a test page for Pages Router</p>
      <nav>
        <Link href="/pages-home" data-testid="home-link">
          Back to Home
        </Link>
      </nav>
    </main>
  );
}

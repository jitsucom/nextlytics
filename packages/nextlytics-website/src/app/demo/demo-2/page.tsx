import Link from "next/link";

export default function Demo2Page() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Demo Page 2</h1>
      <p className="text-muted-foreground mb-4">
        You navigated to a new page. A new page view event should appear in the events panel below.
      </p>
      <Link href="/demo" className="text-primary underline hover:no-underline">
        Go back to Demo
      </Link>
    </div>
  );
}

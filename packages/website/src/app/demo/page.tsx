"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "@/components/ui/code-block";
import { useNextlytics } from "@nextlytics/core/client";
import { Send, Loader2 } from "lucide-react";

function triggerEventsRefresh() {
  window.dispatchEvent(new CustomEvent("nextlytics:refresh"));
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200
            font-mono text-[0.9em] border border-zinc-200 dark:border-zinc-700"
    >
      {children}
    </code>
  );
}

const clientCode = [
  '"use client"',
  "",
  "const { sendEvent } = useNextlytics();",
  "",
  'sendEvent("buttonClick", {',
  '  props: { buttonName: "demo" }',
  "});",
].join("\n");

const serverCode = [
  "// In a Server Action or Route Handler",
  "const { sendEvent } = await analytics();",
  "",
  'await sendEvent("customServerEvent", {',
  '  props: { source: "demo" }',
  "});",
].join("\n");

export default function DemoPage() {
  const { sendEvent } = useNextlytics();
  const [activeTab, setActiveTab] = useState("client");
  const [sending, setSending] = useState(false);

  const handleClientEvent = async () => {
    setSending(true);
    sendEvent("buttonClick", { props: { buttonName: "custom-event-demo" } });
    await new Promise((r) => setTimeout(r, 300));
    triggerEventsRefresh();
    setSending(false);
  };

  const handleServerEvent = async () => {
    setSending(true);
    await fetch("/api/demo/custom", { method: "POST" });
    triggerEventsRefresh();
    setSending(false);
  };

  return (
    <div className="p-6">
      <div className="space-y-4 text-muted-foreground mb-8">
        <p>
          This is a live demo of Nextlytics. When you opened this page, a <Code>pageView</Code>{" "}
          event was automatically tracked. Check the events panel below.
        </p>

        <p>
          Navigate to{" "}
          <Link href="/demo/demo-2" className="text-primary underline hover:no-underline">
            Demo Page 2
          </Link>{" "}
          to see another page view event appear.
        </p>

        <p>Click the Login button to associate all future events with a user ID.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="client">Client-side event</TabsTrigger>
            <TabsTrigger value="server">Server-side event</TabsTrigger>
          </TabsList>
          <Button
            onClick={activeTab === "client" ? handleClientEvent : handleServerEvent}
            size="sm"
            disabled={sending}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send event
          </Button>
        </div>

        <TabsContent value="client" className="mt-0">
          <div className="bg-muted/50 rounded-xl border border-border overflow-hidden">
            <CodeBlock code={clientCode} language="typescript" />
          </div>
        </TabsContent>

        <TabsContent value="server" className="mt-0">
          <div className="bg-muted/50 rounded-xl border border-border overflow-hidden">
            <CodeBlock code={serverCode} language="typescript" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

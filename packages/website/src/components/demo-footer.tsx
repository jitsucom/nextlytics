"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { codeToHtml } from "shiki";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Minus, Loader2, Copy, Check } from "lucide-react";

interface UserContext {
  userId: string;
  traits: {
    email?: string;
    name?: string;
  } & Record<string, unknown>;
}

interface ServerEventContext {
  path: string;
  method: string;
  host?: string;
  ip?: string;
  collectedAt?: string;
  search?: Record<string, string[]>;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
}

interface ClientContext {
  referer?: string;
  path?: string;
  collectedAt?: string;
  screen?: Record<string, unknown>;
  userAgent?: string;
  locale?: string;
}

interface NextlyticsEvent {
  eventId: string;
  parentEventId?: string;
  type: string;
  collectedAt: string;
  anonymousUserId?: string;
  properties: Record<string, unknown>;
  serverContext?: ServerEventContext;
  clientContext?: ClientContext;
  userContext?: UserContext;
}

interface SessionData {
  events: NextlyticsEvent[];
  sessionId: string | null;
}

function getEventTypeColor(type: string): string {
  switch (type) {
    case "pageView":
      return "bg-blue-100 text-blue-700";
    case "apiCall":
      return "bg-amber-100 text-amber-700";
    case "buttonClick":
    case "customClientEvent":
    case "customServerEvent":
      return "bg-yellow-100 text-yellow-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function truncateMiddle(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  const half = Math.floor((maxLen - 3) / 2);
  return str.slice(0, half) + "..." + str.slice(-half);
}

function getExtraJson(event: NextlyticsEvent): string {
  const extra: Record<string, unknown> = {};

  // Add properties
  if (event.properties && Object.keys(event.properties).length > 0) {
    extra.properties = event.properties;
  }

  // Add serverContext excluding displayed fields
  if (event.serverContext) {
    const {
      path: _path,
      host: _host,
      collectedAt: _collectedAt,
      requestHeaders,
      ...rest
    } = event.serverContext;
    const filteredHeaders = requestHeaders
      ? Object.fromEntries(Object.entries(requestHeaders).filter(([k]) => k !== "referer"))
      : undefined;
    const serverCtx = {
      ...rest,
      ...(filteredHeaders && Object.keys(filteredHeaders).length > 0
        ? { requestHeaders: filteredHeaders }
        : {}),
    };
    if (Object.keys(serverCtx).length > 0) {
      extra.serverContext = serverCtx;
    }
  }

  // Add clientContext excluding displayed fields
  if (event.clientContext) {
    const { collectedAt: _collectedAt, referer: _referer, ...rest } = event.clientContext;
    if (Object.keys(rest).length > 0) {
      extra.clientContext = rest;
    }
  }

  // Add userContext excluding what's shown in tooltip
  if (event.userContext) {
    const { userId: _userId, traits, ...rest } = event.userContext;
    const { email: _email, name: _name, ...otherTraits } = traits || {};
    if (Object.keys(otherTraits).length > 0 || Object.keys(rest).length > 0) {
      extra.userContext = { ...rest, traits: otherTraits };
    }
  }

  // Add other fields
  if (event.parentEventId) extra.parentEventId = event.parentEventId;

  return Object.keys(extra).length > 0 ? JSON.stringify(extra) : "";
}

function UserCell({ userContext }: { userContext?: UserContext }) {
  if (!userContext) return <span>-</span>;

  const { userId, traits } = userContext;
  const hasTooltip = traits?.name || traits?.email;

  if (!hasTooltip) return <span>{userId}</span>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default">{userId}</span>
      </TooltipTrigger>
      <TooltipContent>
        {traits.name && <div className="font-medium">{traits.name}</div>}
        {traits.email && <div className="text-muted-foreground">{traits.email}</div>}
      </TooltipContent>
    </Tooltip>
  );
}

function EventRow({ event }: { event: NextlyticsEvent }) {
  const [expanded, setExpanded] = useState(false);
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const time = new Date(event.collectedAt).toLocaleTimeString();
  const extraJson = getExtraJson(event);
  const referer = event.clientContext?.referer || event.serverContext?.requestHeaders?.referer;

  useEffect(() => {
    if (expanded && !html) {
      codeToHtml(JSON.stringify(event, null, 2), {
        lang: "json",
        theme: "github-light",
      }).then(setHtml);
    }
  }, [expanded, html, event]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <tr
        className="border-b border-border last:border-b-0 hover:bg-muted/50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-2 py-1.5 text-muted-foreground font-mono text-xs whitespace-nowrap">
          {time}
        </td>
        <td className="px-2 py-1.5">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getEventTypeColor(event.type)}`}
          >
            {event.type}
          </span>
        </td>
        <td className="px-2 py-1.5 text-xs truncate max-w-[150px]">
          {event.serverContext?.host || "-"}
        </td>
        <td className="px-2 py-1.5 text-xs truncate max-w-[200px]">
          {event.serverContext?.path || "-"}
        </td>
        <td className="px-2 py-1.5 text-xs truncate max-w-[150px]">
          {referer ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default">{referer}</span>
              </TooltipTrigger>
              <TooltipContent>{referer}</TooltipContent>
            </Tooltip>
          ) : (
            "-"
          )}
        </td>
        <td className="px-2 py-1.5 text-xs text-muted-foreground">
          <UserCell userContext={event.userContext} />
        </td>
        <td className="px-2 py-1.5 text-xs text-muted-foreground font-mono truncate max-w-[100px]">
          {event.anonymousUserId ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default">{truncateMiddle(event.anonymousUserId, 12)}</span>
              </TooltipTrigger>
              <TooltipContent className="font-mono text-xs">{event.anonymousUserId}</TooltipContent>
            </Tooltip>
          ) : (
            "-"
          )}
        </td>
        <td className="px-2 py-1.5 text-xs text-muted-foreground font-mono truncate max-w-[300px]">
          {extraJson ? truncateMiddle(extraJson, 60) : "-"}
        </td>
        <td className="px-2 py-1.5 text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-1">
            {expanded && (
              <button
                onClick={handleCopy}
                className="size-5 rounded-full bg-white shadow-sm flex items-center justify-center
                                    hover:bg-muted transition-colors"
              >
                {copied ? (
                  <Check className="size-3 text-green-600" />
                ) : (
                  <Copy className="size-3 text-muted-foreground" />
                )}
              </button>
            )}
            {expanded ? (
              <Minus className="size-3.5 text-muted-foreground" />
            ) : (
              <Plus className="size-3.5 text-muted-foreground" />
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="px-2 pb-3">
            <div
              className="text-[11px] [&_pre]:!bg-transparent [&_pre]:!p-0 [&_code]:!bg-transparent"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </td>
        </tr>
      )}
    </>
  );
}

export function DemoFooter() {
  const [data, setData] = useState<SessionData>({ events: [], sessionId: null });
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pathname = usePathname();
  const isFirstMount = useRef(true);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/demo/events");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch events:", err);
    }
  }, []);

  const clearSession = async () => {
    await fetch("/api/demo/events", { method: "DELETE", credentials: "same-origin" });
    window.location.reload();
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      await fetchEvents();
      setInitialLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [fetchEvents]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      fetchEvents();
    }, 1000);
    return () => clearTimeout(timer);
  }, [pathname, fetchEvents]);

  useEffect(() => {
    const handleRefreshRequest = () => {
      setTimeout(fetchEvents, 1000);
    };
    window.addEventListener("nextlytics:refresh", handleRefreshRequest);
    return () => window.removeEventListener("nextlytics:refresh", handleRefreshRequest);
  }, [fetchEvents]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  };

  const sortedEvents = [...data.events].sort(
    (a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime()
  );

  return (
    <TooltipProvider delayDuration={100}>
      <footer className="h-full border-t border-border bg-muted/30 flex flex-col">
        <div className="px-2 py-1.5 border-b border-border flex items-center justify-between bg-muted/50">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide">
              Events ({data.events.length})
            </h3>
            <span className="text-[10px] text-muted-foreground">
              events appear with small delay
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-6 px-2 text-xs"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSession}
              className="h-6 px-2 text-xs hover:text-destructive hover:border-destructive"
            >
              Clear
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-scroll text-sm">
          {initialLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedEvents.length === 0 ? (
            <div className="text-muted-foreground p-4">
              No events yet. Navigate between pages to see events.
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr className="border-b border-border text-left">
                  <th className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-20">
                    Time
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-24">
                    Type
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    Host
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    Path
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    Referer
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-32">
                    User
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-24">
                    Anon ID
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    Extra
                  </th>
                  <th className="px-2 py-1.5 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {sortedEvents.map((event) => (
                  <EventRow key={event.eventId} event={event} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </footer>
    </TooltipProvider>
  );
}

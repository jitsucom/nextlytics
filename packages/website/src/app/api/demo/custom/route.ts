import { after } from "next/server";
import { analytics } from "@/nextlytics";

export async function POST() {
  const { sendEvent } = await analytics();
  after(sendEvent("customServerEvent", { props: { source: "demo-footer" } }));
  return Response.json({ ok: true });
}

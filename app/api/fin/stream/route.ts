import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MS = 4000;
const MAX_DURATION_MS = 55_000;

/**
 * Server-Sent Events feed for FIN live synchronization.
 *
 * Emits a `fin-update` event whenever a new `FinEvent` or `Session` appears
 * after the client's `since` cursor. Works on Railway (persistent Node) and
 * on Vercel (short-lived responses — clients reconnect automatically).
 * Customers only see their own activity; analysts see the global feed.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  let since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 60_000);
  if (Number.isNaN(since.getTime())) since = new Date(Date.now() - 60_000);

  const isAdmin = isAdminRole(session.user.role);
  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("ready", { at: new Date().toISOString(), role: session.user.role });

      const interval = setInterval(async () => {
        if (Date.now() - startedAt > MAX_DURATION_MS) {
          send("reconnect", { at: new Date().toISOString() });
          clearInterval(interval);
          controller.close();
          return;
        }

        try {
          const [latestEvent, latestSession] = await Promise.all([
            prisma.finEvent.findFirst({
              where: {
                createdAt: { gt: since },
                ...(isAdmin ? {} : { userId: session.user.id }),
              },
              orderBy: { createdAt: "desc" },
              select: { id: true, createdAt: true, type: true },
            }),
            prisma.session.findFirst({
              where: {
                startedAt: { gt: since },
                ...(isAdmin ? {} : { userId: session.user.id }),
              },
              orderBy: { startedAt: "desc" },
              select: { id: true, startedAt: true },
            }),
          ]);

          const newest = [latestEvent?.createdAt, latestSession?.startedAt]
            .filter((value): value is Date => Boolean(value))
            .sort((a, b) => b.getTime() - a.getTime())[0];

          if (newest) {
            since = newest;
            send("fin-update", {
              at: newest.toISOString(),
              eventId: latestEvent?.id ?? null,
              eventType: latestEvent?.type ?? null,
              sessionId: latestSession?.id ?? null,
            });
          } else {
            send("ping", { at: new Date().toISOString() });
          }
        } catch (error) {
          console.error("[fin/stream] poll failed", error);
          send("error", { message: "poll-failed" });
        }
      }, POLL_MS);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

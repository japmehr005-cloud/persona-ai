import type { AssistantMessageRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface AssistantMessageView {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface AssistantThreadView {
  id: string;
  title: string | null;
  updatedAt: string;
  messages: AssistantMessageView[];
}

export interface AssistantThreadSummary {
  id: string;
  title: string | null;
  updatedAt: string;
  preview: string | null;
}

function toUiRole(role: AssistantMessageRole): "user" | "assistant" | "system" {
  if (role === "USER") return "user";
  if (role === "ASSISTANT") return "assistant";
  return "system";
}

function toDbRole(role: "user" | "assistant" | "system"): AssistantMessageRole {
  if (role === "user") return "USER";
  if (role === "assistant") return "ASSISTANT";
  return "SYSTEM";
}

function mapThread(thread: {
  id: string;
  title: string | null;
  updatedAt: Date;
  messages: Array<{
    id: string;
    role: AssistantMessageRole;
    content: string;
    createdAt: Date;
  }>;
}): AssistantThreadView {
  return {
    id: thread.id,
    title: thread.title,
    updatedAt: thread.updatedAt.toISOString(),
    messages: thread.messages.map((m) => ({
      id: m.id,
      role: toUiRole(m.role),
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

const WELCOME =
  "Hello — I’m Persona AI, your financial intelligence copilot. I explain risk decisions, review logins, analyze spending, and surface savings opportunities using only your real account data.";

export async function listAssistantThreads(userId: string): Promise<AssistantThreadSummary[]> {
  const threads = await prisma.assistantThread.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        where: { role: "USER" },
      },
    },
  });

  return threads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    updatedAt: thread.updatedAt.toISOString(),
    preview: thread.messages[0]?.content ?? null,
  }));
}

export async function getAssistantThread(
  userId: string,
  threadId: string
): Promise<AssistantThreadView | null> {
  const thread = await prisma.assistantThread.findFirst({
    where: { id: threadId, userId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 100 },
    },
  });
  return thread ? mapThread(thread) : null;
}

export async function getOrCreateAssistantThread(userId: string): Promise<AssistantThreadView> {
  let thread = await prisma.assistantThread.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 100 },
    },
  });

  if (!thread) {
    thread = await prisma.assistantThread.create({
      data: {
        userId,
        title: "New conversation",
        messages: {
          create: {
            role: "ASSISTANT",
            content: WELCOME,
          },
        },
      },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  return mapThread(thread);
}

export async function createAssistantThread(userId: string): Promise<AssistantThreadView> {
  const thread = await prisma.assistantThread.create({
    data: {
      userId,
      title: "New conversation",
      messages: {
        create: {
          role: "ASSISTANT",
          content: WELCOME,
        },
      },
    },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  return mapThread(thread);
}

export async function appendAssistantMessages(params: {
  userId: string;
  threadId: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
}): Promise<void> {
  const thread = await prisma.assistantThread.findFirst({
    where: { id: params.threadId, userId: params.userId },
    select: { id: true, title: true },
  });
  if (!thread) {
    throw new Error("Assistant thread not found");
  }

  const firstUser = params.messages.find((m) => m.role === "user");
  const shouldTitle =
    firstUser &&
    (!thread.title || thread.title === "New conversation" || thread.title === "Persona AI");

  await prisma.$transaction([
    prisma.assistantMessage.createMany({
      data: params.messages.map((message) => ({
        threadId: params.threadId,
        role: toDbRole(message.role),
        content: message.content,
      })),
    }),
    prisma.assistantThread.update({
      where: { id: params.threadId },
      data: {
        updatedAt: new Date(),
        ...(shouldTitle
          ? { title: firstUser!.content.slice(0, 72) + (firstUser!.content.length > 72 ? "…" : "") }
          : {}),
      },
    }),
  ]);
}

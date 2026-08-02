import { AssistantChat } from "@/features/assistant/assistant-chat";
import { getAssistantBootstrapAction } from "@/features/assistant/assistant-actions";

export const metadata = {
  title: "Persona AI",
};

export default async function AssistantPage() {
  const { thread, threads, insights } = await getAssistantBootstrapAction();

  return (
    <div className="w-full md:px-4 md:py-4 lg:px-6">
      <AssistantChat
        initialThread={thread}
        initialThreads={threads}
        insights={insights}
      />
    </div>
  );
}

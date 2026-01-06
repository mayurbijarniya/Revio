"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Send,
  Loader2,
  AlertCircle,
  FolderGit2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface Conversation {
  id: string;
  title: string;
  repositoryName: string;
  lastMessage?: string;
  updatedAt: Date;
}

interface ConversationViewProps {
  conversation: {
    id: string;
    title: string;
    repositoryName: string;
  };
  initialMessages: Message[];
  conversations: Conversation[];
}

export function ConversationView({
  conversation,
  initialMessages,
  conversations,
}: ConversationViewProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: input.trim(),
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/chat/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage.content }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== userMessage.id);
          return [
            ...filtered,
            {
              id: data.data.userMessage.id,
              role: "user",
              content: data.data.userMessage.content,
              createdAt: new Date(data.data.userMessage.createdAt),
            },
            {
              id: data.data.assistantMessage.id,
              role: "assistant",
              content: data.data.assistantMessage.content,
              createdAt: new Date(data.data.assistantMessage.createdAt),
            },
          ];
        });
      } else {
        setError(data.error?.message || "Failed to send message");
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      }
    } catch {
      setError("Failed to send message");
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage();
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col">
        {/* New Chat Button */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => router.push("/dashboard/chat")}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => router.push(`/dashboard/chat/${conv.id}`)}
                className={cn(
                  "w-full text-left p-3 rounded-lg transition-colors",
                  conversation.id === conv.id
                    ? "bg-blue-100 dark:bg-blue-900"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                <div className="font-medium text-sm truncate">{conv.title}</div>
                <div className="text-xs text-gray-500 truncate mt-1">
                  {conv.repositoryName}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <FolderGit2 className="w-5 h-5 text-gray-400" />
            <div>
              <h1 className="font-semibold">{conversation.title}</h1>
              <p className="text-sm text-gray-500">{conversation.repositoryName}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </div>
          )}

          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "p-4 rounded-lg",
                  message.role === "user"
                    ? "bg-blue-100 dark:bg-blue-900 ml-12"
                    : "bg-gray-100 dark:bg-gray-800 mr-12"
                )}
              >
                <div className="text-xs text-gray-500 mb-1">
                  {message.role === "user" ? "You" : "Revio"}
                </div>
                <div className="prose dark:prose-invert prose-sm max-w-none whitespace-pre-wrap">
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a follow-up question..."
                disabled={isLoading}
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

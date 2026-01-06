"use client";

import { useState } from "react";
import {
  MessageSquare,
  Plus,
  FolderGit2,
  ChevronDown,
  Loader2,
  Send,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Repository {
  id: string;
  fullName: string;
  language: string | null;
}

interface Conversation {
  id: string;
  title: string;
  repositoryName: string;
  lastMessage?: string;
  updatedAt: Date;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface ChatLayoutProps {
  repositories: Repository[];
  conversations: Conversation[];
}

export function ChatLayout({ repositories, conversations: initialConversations }: ChatLayoutProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRepoSelector, setShowRepoSelector] = useState(false);

  async function loadConversation(conversationId: string) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data.conversation.messages);
        setSelectedConversation(conversationId);
      } else {
        setError(data.error?.message || "Failed to load conversation");
      }
    } catch {
      setError("Failed to load conversation");
    } finally {
      setIsLoading(false);
    }
  }

  async function startNewConversation() {
    if (!selectedRepo || !input.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryId: selectedRepo.id,
          message: input.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        const conv = data.data.conversation;
        setSelectedConversation(conv.id);
        setMessages(conv.messages);
        setConversations((prev) => [
          {
            id: conv.id,
            title: conv.title,
            repositoryName: selectedRepo.fullName,
            lastMessage: input.trim().slice(0, 60),
            updatedAt: new Date(),
          },
          ...prev,
        ]);
        setInput("");
      } else {
        setError(data.error?.message || "Failed to start conversation");
      }
    } catch {
      setError("Failed to start conversation");
    } finally {
      setIsLoading(false);
    }
  }

  async function sendMessage() {
    if (!selectedConversation || !input.trim()) return;

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
      const res = await fetch(`/api/chat/conversations/${selectedConversation}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage.content }),
      });
      const data = await res.json();
      if (data.success) {
        // Replace temp user message with actual one and add assistant message
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
        // Remove temp message on error
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
    if (selectedConversation) {
      sendMessage();
    } else {
      startNewConversation();
    }
  }

  function handleNewChat() {
    setSelectedConversation(null);
    setMessages([]);
    setInput("");
    setError(null);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col">
        {/* New Chat Button */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-colors",
                    selectedConversation === conv.id
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
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        {!selectedConversation && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <button
                onClick={() => setShowRepoSelector(!showRepoSelector)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <FolderGit2 className="w-4 h-4" />
                <span>{selectedRepo?.fullName || "Select a repository"}</span>
                <ChevronDown className="w-4 h-4 ml-2" />
              </button>

              {showRepoSelector && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 border rounded-lg shadow-lg z-10">
                  {repositories.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No indexed repositories. Index a repository first.
                    </div>
                  ) : (
                    repositories.map((repo) => (
                      <button
                        key={repo.id}
                        onClick={() => {
                          setSelectedRepo(repo);
                          setShowRepoSelector(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
                      >
                        <div className="font-medium text-sm">{repo.fullName}</div>
                        {repo.language && (
                          <div className="text-xs text-gray-500">{repo.language}</div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </div>
          )}

          {messages.length === 0 && !selectedConversation ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Chat with your codebase</h2>
                <p className="text-gray-500 mb-4">
                  Ask questions about your code, find specific functions, understand
                  architecture, and more.
                </p>
                {!selectedRepo && repositories.length > 0 && (
                  <p className="text-sm text-blue-600">
                    Select a repository above to get started
                  </p>
                )}
              </div>
            </div>
          ) : (
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
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  selectedConversation
                    ? "Ask a follow-up question..."
                    : selectedRepo
                    ? "Ask a question about your code..."
                    : "Select a repository first"
                }
                disabled={isLoading || (!selectedConversation && !selectedRepo)}
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || (!selectedConversation && !selectedRepo)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

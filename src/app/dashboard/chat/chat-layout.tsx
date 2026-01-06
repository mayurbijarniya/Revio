"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  MessageSquare,
  Plus,
  FolderGit2,
  ChevronDown,
  Loader2,
  Send,
  AlertCircle,
  Check,
  Download,
  Trash2,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  initialConversationId?: string;
  initialMessages?: Message[];
  initialSelectedRepos?: Repository[];
}

export function ChatLayout({
  repositories,
  conversations: initialConversations,
  initialConversationId,
  initialMessages,
  initialSelectedRepos,
}: ChatLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedRepos, setSelectedRepos] = useState<Repository[]>(initialSelectedRepos || []);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(initialConversationId || null);
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  // Handle initial conversation from URL
  useEffect(() => {
    if (initialConversationId && initialMessages) {
      setSelectedConversation(initialConversationId);
      setMessages(initialMessages);
    }
    if (initialSelectedRepos) {
      setSelectedRepos(initialSelectedRepos);
    }
  }, [initialConversationId, initialMessages, initialSelectedRepos]);

  // Close dropdown when clicking outside
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRepoDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadConversation(conversationId: string) {
    // Navigate to conversation URL if not already there
    if (pathname !== `/dashboard/chat/${conversationId}`) {
      router.push(`/dashboard/chat/${conversationId}`);
      return;
    }

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
    if (selectedRepos.length === 0 || !input.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryIds: selectedRepos.map((r) => r.id),
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
            repositoryName: selectedRepos.map((r) => r.fullName).join(", "),
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
    setShowRepoDropdown(false);
    setSelectedRepos([]);
    // Navigate to main chat page if we're on a conversation page
    if (pathname.startsWith("/dashboard/chat/")) {
      router.push("/dashboard/chat");
    }
  }

  function exportConversation() {
    if (!messages.length) return;

    const currentConv = conversations.find((c) => c.id === selectedConversation);
    const title = currentConv?.title || "Conversation";
    const repoName = currentConv?.repositoryName || "Unknown Repository";

    let markdown = `# ${title}\n\n`;
    markdown += `**Repository:** ${repoName}\n`;
    markdown += `**Exported:** ${new Date().toLocaleString()}\n\n`;
    markdown += `---\n\n`;

    messages.forEach((msg) => {
      const role = msg.role === "user" ? "You" : "Revio AI";
      const time = new Date(msg.createdAt).toLocaleString();
      markdown += `### ${role} (${time})\n\n`;
      markdown += `${msg.content}\n\n`;
    });

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function copyLink() {
    if (!selectedConversation) return;
    const link = `${window.location.origin}/dashboard/chat/${selectedConversation}`;
    navigator.clipboard.writeText(link);
  }

  function openDeleteDialog(conversationId: string) {
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  }

  function closeDeleteDialog() {
    setDeleteDialogOpen(false);
    setConversationToDelete(null);
  }

  async function handleConfirmDelete() {
    if (!conversationToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/chat/conversations/${conversationToDelete}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setConversations((prev) => prev.filter((c) => c.id !== conversationToDelete));
        if (selectedConversation === conversationToDelete) {
          setSelectedConversation(null);
          setMessages([]);
        }
        closeDeleteDialog();
      } else {
        setError(data.error?.message || "Failed to delete conversation");
      }
    } catch {
      setError("Failed to delete conversation");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] scrollbar-hide">
      {/* Sidebar - Fixed 280px width */}
      <div className="w-72 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col flex-shrink-0">
        {/* New Chat Button */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] transition-all font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
          {conversations.length === 0 ? (
            <div className="p-3 text-center text-gray-500">
              <div className="w-10 h-10 mx-auto mb-2 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 opacity-50" />
              </div>
              <p className="text-xs">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "group relative w-full text-left p-2.5 rounded-lg transition-all text-sm",
                    selectedConversation === conv.id
                      ? "bg-white dark:bg-gray-800 shadow-sm border border-[#4F46E5]/30 dark:border-[#4F46E5]/30"
                      : "hover:bg-white dark:hover:bg-gray-800 border border-transparent"
                  )}
                >
                  <button
                    onClick={() => loadConversation(conv.id)}
                    className="w-full text-left"
                  >
                    <div className="font-medium text-xs truncate flex items-center gap-1.5 pr-6">
                      <FolderGit2 className="w-3 h-3 text-gray-400 shrink-0" />
                      <span className="truncate">{conv.title}</span>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteDialog(conv.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[#FEF2F2] dark:hover:bg-[#7F1D1D] text-gray-400 hover:text-[#EF4444] transition-all"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with Export Button - when conversation is selected */}
        {selectedConversation && messages.length > 0 && (
          <>
            <div className="sticky top-0 z-100 flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#4F46E5]" />
                <span className="font-medium text-sm truncate max-w-[300px]">
                  {conversations.find((c) => c.id === selectedConversation)?.title || "Conversation"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyLink}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-[#4F46E5] hover:bg-[#EEF2FF] dark:hover:bg-[#1E1B4B] rounded-lg transition-colors"
                  title="Copy link to this conversation"
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </button>
                <button
                  onClick={exportConversation}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-[#4F46E5] hover:bg-[#EEF2FF] dark:hover:bg-[#1E1B4B] rounded-lg transition-colors"
                  title="Export conversation as Markdown"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>
            {/* Repo tags for conversation */}
            {selectedRepos.length > 0 && (
              <div className="sticky top-[57px] z-90 px-6 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedRepos.map((repo) => (
                    <span
                      key={repo.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-[#EEF2FF] dark:bg-[#4F46E5]/30 text-[#4F46E5] dark:text-[#A5B4FC] rounded text-xs"
                    >
                      <FolderGit2 className="w-3 h-3" />
                      <span className="truncate max-w-[150px]">{repo.fullName.split("/")[1]}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Header with Repo Selector - Sticky with z-index 100 */}
        {!selectedConversation && repositories.length > 0 && (
          <div className="sticky top-0 z-100 flex items-center gap-2 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            {/* Selected Repo Display / Trigger */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowRepoDropdown(!showRepoDropdown)}
                className={cn(
                  "repo-selector-button",
                  selectedRepos.length > 0 && "active"
                )}
              >
                <FolderGit2 className="w-4 h-4" />
                <span className="truncate max-w-[180px]">
                  {selectedRepos.length === 0
                    ? "Select Repos"
                    : selectedRepos.length === 1
                    ? selectedRepos[0]!.fullName.split("/")[1] || selectedRepos[0]!.fullName
                    : `${selectedRepos.length} repos selected`}
                </span>
                <ChevronDown className={cn("w-4 h-4 transition-transform ml-auto", showRepoDropdown && "rotate-180")} />
              </button>

              {/* Dropdown Overlay - Absolute positioning, z-index 1000 */}
              {showRepoDropdown && (
                <div className="repo-dropdown-menu animate-dropdown">
                  {repositories.map((repo) => {
                    const isSelected = selectedRepos.some((r) => r.id === repo.id);
                    return (
                      <button
                        key={repo.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedRepos((prev) => prev.filter((r) => r.id !== repo.id));
                          } else {
                            setSelectedRepos((prev) => [...prev, repo]);
                          }
                        }}
                        className={cn(
                          "repo-dropdown-item w-full",
                          isSelected && "selected"
                        )}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                            isSelected
                              ? "bg-[#4F46E5] border-[#4F46E5]"
                              : "border-gray-300 dark:border-gray-600"
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <FolderGit2 className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
                        <div className="flex-1 min-w-0">
                          <div className="repo-name truncate">{repo.fullName.split("/")[1] || repo.fullName}</div>
                          {repo.language && <div className="repo-lang">{repo.language}</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Repos Tags */}
            {selectedRepos.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedRepos.map((repo) => (
                  <span
                    key={repo.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-[#EEF2FF] dark:bg-[#4F46E5]/30 text-[#4F46E5] dark:text-[#A5B4FC] rounded text-xs"
                  >
                    <FolderGit2 className="w-3 h-3" />
                    <span className="truncate max-w-[120px]">{repo.fullName.split("/")[1]}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-hide">
          {error && (
            <div className="mb-4 p-3 bg-[#FEF2F2] dark:bg-[#7F1D1D] border border-[#FECACA] dark:border-[#991B1B] rounded-lg flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-[#EF4444]" />
              <span className="text-sm text-[#991B1B] dark:text-[#FECACA]">{error}</span>
            </div>
          )}

          {messages.length === 0 && !selectedConversation ? (
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center max-w-lg">
                <div className="w-16 h-16 mx-auto mb-4 bg-[#EEF2FF] dark:bg-[#1E1B4B] rounded-2xl flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-[#4F46E5]" />
                </div>
                <h2 className="text-xl font-bold mb-2">Chat with your codebase</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                  Ask questions about your code, find specific functions, understand architecture.
                </p>
                {selectedRepos.length === 0 && repositories.length > 0 && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#4F46E5] rounded-lg text-sm">
                    <FolderGit2 className="w-4 h-4" />
                    Select repositories to get started
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5 max-w-[1200px] mx-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-start gap-4",
                    message.role === "user" ? "flex-row-reverse" : ""
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-1",
                      message.role === "user" ? "bg-gray-400" : "bg-[#14B8A6]"
                    )}
                  >
                    {message.role === "user" ? (
                      <span className="text-white text-sm font-medium">Y</span>
                    ) : (
                      <MessageSquare className="w-4 h-4 text-white" />
                    )}
                  </div>

                  {/* Message bubble */}
                  <div
                    className={cn(
                      "px-5 py-4 rounded-2xl text-[15px]",
                      message.role === "user"
                        ? "bg-[#EEF2FF] border border-[#E0E7FF] rounded-tr-4xl max-w-[80%] leading-relaxed"
                        : "bg-white border border-gray-200 dark:border-gray-700 rounded-tl-4xl max-w-[85%] leading-loose"
                    )}
                  >
                    <MarkdownRenderer content={message.content} />
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area - Sticky with z-index 10 */}
        <div className="sticky bottom-0 z-10 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <form onSubmit={handleSubmit} className="max-w-[1200px] mx-auto">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  selectedConversation
                    ? "Ask a follow-up question..."
                    : selectedRepos.length > 0
                    ? "Ask a question about your code..."
                    : "Select repositories first"
                }
                disabled={isLoading || (!selectedConversation && selectedRepos.length === 0)}
                className="w-full px-5 py-3 pr-12 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all text-[15px] text-gray-900 dark:text-white placeholder:text-gray-500"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || (!selectedConversation && selectedRepos.length === 0)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={closeDeleteDialog}
        onConfirm={handleConfirmDelete}
        title="Delete Conversation"
        message="Are you sure you want to delete this conversation? This action cannot be undone and all messages will be permanently removed."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

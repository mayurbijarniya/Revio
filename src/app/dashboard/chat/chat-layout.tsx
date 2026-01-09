"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  MessageSquare,
  Plus,
  FolderGit2,
  ChevronDown,
  Loader2,
  AlertCircle,
  Check,
  Trash2,
  Copy,
  ArrowUp,
  ArrowLeft,
  MoreVertical,
  Edit2,
  Pin,
  PinOff,
  X,
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
  isPinned?: boolean;
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
  const [copySuccess, setCopySuccess] = useState(false);
  const [showMenuId, setShowMenuId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [conversationToRename, setConversationToRename] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

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

  // Close menu when clicking outside
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenuId(null);
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
            isPinned: false,
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

  function copyMarkdown() {
    if (!messages.length) return;

    const currentConv = conversations.find((c) => c.id === selectedConversation);
    const title = currentConv?.title || "Conversation";
    const repoName = currentConv?.repositoryName || "Unknown Repository";

    let markdown = `# ${title}\n\n`;
    markdown += `**Repository:** ${repoName}\n`;
    markdown += `**Exported:** ${new Date().toLocaleString()}\n\n`;
    markdown += `---\n\n`;

    messages.forEach((msg) => {
      const role = msg.role === "user" ? "User" : "Revio AI";
      markdown += `### ${role}\n\n`;
      markdown += `${msg.content}\n\n`;
    });

    navigator.clipboard.writeText(markdown);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }

  function openDeleteDialog(conversationId: string) {
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
    setShowMenuId(null);
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

  function openRenameDialog(conversationId: string) {
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv) {
      setConversationToRename(conversationId);
      setRenameInput(conv.title);
      setRenameDialogOpen(true);
      setShowMenuId(null);
    }
  }

  function closeRenameDialog() {
    setRenameDialogOpen(false);
    setConversationToRename(null);
    setRenameInput("");
  }

  async function handleRename() {
    if (!conversationToRename || !renameInput.trim()) return;

    setIsRenaming(true);
    try {
      const res = await fetch(`/api/chat/conversations/${conversationToRename}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationToRename ? { ...c, title: renameInput.trim() } : c
          )
        );
        closeRenameDialog();
      } else {
        setError(data.error?.message || "Failed to rename conversation");
      }
    } catch {
      setError("Failed to rename conversation");
    } finally {
      setIsRenaming(false);
    }
  }

  async function togglePin(conversationId: string) {
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    setShowMenuId(null);
    const newPinnedState = !conv.isPinned;

    // Optimistic update
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, isPinned: newPinnedState } : c))
    );

    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: newPinnedState }),
      });
      const data = await res.json();
      if (!data.success) {
        // Revert on error
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, isPinned: !newPinnedState } : c))
        );
        setError(data.error?.message || "Failed to pin conversation");
      }
    } catch {
      // Revert on error
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, isPinned: !newPinnedState } : c))
      );
      setError("Failed to pin conversation");
    }
  }

  // Sort conversations: pinned first, then by updatedAt
  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] scrollbar-hide bg-gray-50">
      {/* Sidebar - Fixed 280px width on desktop, full width on mobile when active */}
      <div
        className={cn(
          "border-r border-gray-200 bg-white flex-col flex-shrink-0 bg-white md:w-72 md:flex",
          selectedConversation ? "hidden" : "flex w-full"
        )}
      >
        {/* New Chat Button */}
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] transition-all font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="p-3 text-center text-gray-500">
              <div className="w-10 h-10 mx-auto mb-2 bg-gray-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-xs">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sortedConversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "group relative w-full text-left p-3 rounded-lg transition-all text-sm",
                    selectedConversation === conv.id
                      ? "bg-indigo-50 border border-indigo-200"
                      : "hover:bg-gray-100 border border-transparent"
                  )}
                >
                  <button
                    onClick={() => loadConversation(conv.id)}
                    className="w-full text-left"
                  >
                    <div className="font-medium text-sm truncate flex items-center gap-2 pr-12 mb-0.5">
                      {conv.isPinned && <Pin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                      <FolderGit2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      <span className="text-gray-900 truncate">{conv.title}</span>
                    </div>
                    <div className="text-xs text-gray-500 truncate pl-5.5">
                      {conv.lastMessage || "No messages yet"}
                    </div>
                  </button>

                  {/* Three-dot menu */}
                  <div className="absolute right-2 top-3" ref={showMenuId === conv.id ? menuRef : null}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenuId(showMenuId === conv.id ? null : conv.id);
                      }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-all"
                      title="More actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown menu */}
                    {showMenuId === conv.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openRenameDialog(conv.id);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin(conv.id);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          {conv.isPinned ? (
                            <>
                              <PinOff className="w-3.5 h-3.5" />
                              Unpin
                            </>
                          ) : (
                            <>
                              <Pin className="w-3.5 h-3.5" />
                              Pin
                            </>
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteDialog(conv.id);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div
        className={cn(
          "flex-1 flex-col min-w-0 bg-gray-50",
          !selectedConversation ? "hidden md:flex" : "flex"
        )}
      >
        {/* Mobile Header - Active Conversation */}
        {selectedConversation && (
          <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
            <button
              onClick={() => setSelectedConversation(null)}
              className="p-1 -ml-1 text-gray-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="font-medium truncate flex-1">
              {conversations.find(c => c.id === selectedConversation)?.title || "Chat"}
            </div>
          </div>
        )}

        {/* Header with Repo Selector - when creating new chat */}
        {!selectedConversation && repositories.length > 0 && (
          <div className="sticky top-0 z-100 flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white">
            {/* Selected Repo Display / Trigger */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowRepoDropdown(!showRepoDropdown)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                  selectedRepos.length > 0
                    ? "bg-indigo-50 border-indigo-200 text-gray-700"
                    : "bg-gray-100 border-gray-200 text-gray-500 hover:border-indigo-400"
                )}
              >
                <FolderGit2 className="w-4 h-4" />
                <span className="text-sm truncate max-w-[180px]">
                  {selectedRepos.length === 0
                    ? "Select Repos"
                    : selectedRepos.length === 1
                      ? selectedRepos[0]!.fullName.split("/")[1] || selectedRepos[0]!.fullName
                      : `${selectedRepos.length} repos`}
                </span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", showRepoDropdown && "rotate-180")} />
              </button>

              {/* Dropdown */}
              {showRepoDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 animate-dropdown">
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
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 transition-colors"
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                            isSelected
                              ? "bg-indigo-600 border-indigo-600"
                              : "border-gray-300"
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <FolderGit2 className="w-4 h-4 text-gray-500" />
                        <div className="flex-1 min-w-0 text-left">
                          <div className="text-sm text-gray-700 truncate">
                            {repo.fullName.split("/")[1] || repo.fullName}
                          </div>
                          {repo.language && (
                            <div className="text-xs text-gray-500">{repo.language}</div>
                          )}
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
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-700"
                  >
                    <FolderGit2 className="w-3 h-3" />
                    <span className="truncate max-w-[120px]">{repo.fullName.split("/")[1]}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-10 py-6 pb-40 scrollbar-hide">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          {messages.length === 0 && !selectedConversation ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-lg">
                <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 rounded-2xl flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Chat with your codebase</h2>
                <p className="text-gray-600 text-sm mb-4">
                  Ask questions about your code, find specific functions, understand architecture.
                </p>
                {selectedRepos.length === 0 && repositories.length > 0 && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500">
                    <FolderGit2 className="w-4 h-4" />
                    Select repositories to get started
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-12">
              {messages.map((message) => (
                <div key={message.id} className="animate-fade-in">
                  {/* User Question - HAS container */}
                  {message.role === "user" && (
                    <div className="max-w-3xl mx-auto my-6">
                      <div className="bg-white border border-gray-200 rounded-lg px-5 py-3 shadow-sm">
                        <p className="text-sm text-gray-800 text-left leading-relaxed">{message.content}</p>
                      </div>
                    </div>
                  )}

                  {/* AI Response - NO container, flows directly on background */}
                  {message.role === "assistant" && (
                    <div className="max-w-3xl mx-auto px-6">
                      <div className="text-gray-800 text-sm leading-relaxed space-y-4">
                        <MarkdownRenderer content={message.content} />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Bar - Status + Input combined */}
        {selectedConversation && messages.length > 0 ? (
          <div className="fixed bottom-6 left-4 md:left-80 right-4 md:right-6 z-50">
            <div className="max-w-3xl mx-auto">
              {/* Status Bar */}
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border border-gray-200 border-b-0 rounded-t-lg">
                {/* Left: Repository info */}
                <div className="flex items-center gap-4">
                  {selectedRepos.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <FolderGit2 className="w-4 h-4 text-gray-500" />
                      <span className="truncate max-w-[200px] font-medium">
                        {selectedRepos.map(r => r.fullName).join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={copyMarkdown}
                    className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded text-xs text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    {copySuccess ? (
                      <>
                        <Check className="w-3 h-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy as markdown
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Input Area */}
              <form onSubmit={handleSubmit}>
                <div className="relative bg-white border border-gray-200 rounded-b-lg shadow-sm">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a follow-up question..."
                    disabled={isLoading}
                    className="w-full px-5 py-4 pr-14 bg-transparent rounded-b-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base leading-relaxed text-gray-900 placeholder:text-gray-500"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    <ArrowUp className="w-4 h-4 text-white" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* Input Area for New Chat */
          <div className="fixed bottom-6 left-4 md:left-80 right-4 md:right-6 z-50">
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
              <div className="relative bg-white border border-gray-200 rounded-lg shadow-sm">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    selectedRepos.length > 0
                      ? "Ask about the codebase..."
                      : "Select repositories first"
                  }
                  disabled={isLoading || (!selectedConversation && selectedRepos.length === 0)}
                  className="w-full px-5 py-4 pr-14 bg-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base leading-relaxed text-gray-900 placeholder:text-gray-500"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim() || (!selectedConversation && selectedRepos.length === 0)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <ArrowUp className="w-4 h-4 text-white" />
                </button>
              </div>
            </form>
          </div>
        )}
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

      {/* Rename Dialog */}
      {renameDialogOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Rename Conversation</h3>
                <button
                  onClick={closeRenameDialog}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-5">
              <input
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                placeholder="Enter new title..."
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={closeRenameDialog}
                disabled={isRenaming}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={isRenaming || !renameInput.trim()}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isRenaming && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

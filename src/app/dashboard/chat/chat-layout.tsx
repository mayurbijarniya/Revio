"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  Search,
  FileText,
  ChevronsDown,
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
  mode?: "indexed" | "full_repo";
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
  initialMode?: "indexed" | "full_repo";
}

export function ChatLayout({
  repositories,
  conversations: initialConversations,
  initialConversationId,
  initialMessages,
  initialSelectedRepos,
  initialMode,
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
  const [selectedMode, setSelectedMode] = useState<"indexed" | "full_repo">(initialMode || "indexed");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 100;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    setIsAtBottom(atBottom);
  }, []);

  // Auto-scroll to bottom when messages change, only if already at bottom
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom]);

  // Always scroll to bottom on conversation switch
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    setIsAtBottom(true);
  }, [selectedConversation]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  }

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

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

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: input.trim(),
      createdAt: new Date(),
    };
    const streamingId = `streaming-${Date.now()}`;

    setMessages([
      userMessage,
      { id: streamingId, role: "assistant", content: "", createdAt: new Date() },
    ]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setTimeout(() => inputRef.current?.focus(), 50);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({
          repositoryIds: selectedRepos.map((r) => r.id),
          message: userMessage.content,
          mode: selectedMode,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let convId = "";
      let convTitle = "";
      let firstEvent = true;
      let finalId = streamingId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = JSON.parse(line.slice(6));

          if (firstEvent && payload.conversationId) {
            // First event — conversation metadata
            convId = payload.conversationId;
            convTitle = payload.title;
            setSelectedConversation(convId);
            setConversations((prev) => [
              {
                id: convId,
                title: convTitle,
                repositoryName: selectedRepos.map((r) => r.fullName).join(", "),
                lastMessage: userMessage.content.slice(0, 60),
                updatedAt: new Date(),
                isPinned: false,
                mode: selectedMode,
              },
              ...prev,
            ]);
            firstEvent = false;
          } else if (payload.done) {
            if (payload.messageId) finalId = payload.messageId;
          } else if (payload.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingId ? { ...m, content: m.content + payload.content } : m
              )
            );
            if (isAtBottom) {
              messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
            }
          }
        }
      }

      // Settle user message id and assistant message id
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === streamingId) return { ...m, id: finalId };
          if (m.id === userMessage.id) return { ...m, id: m.id };
          return m;
        })
      );
    } catch {
      setMessages([]);
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
    const streamingId = `streaming-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: streamingId, role: "assistant", content: "", createdAt: new Date() },
    ]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setTimeout(() => inputRef.current?.focus(), 50);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/chat/conversations/${selectedConversation}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({ content: userMessage.content }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalId = streamingId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = JSON.parse(line.slice(6));

          if (payload.done) {
            if (payload.messageId) finalId = payload.messageId;
          } else if (payload.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingId ? { ...m, content: m.content + payload.content } : m
              )
            );
            // Scroll on each chunk if at bottom
            if (isAtBottom) {
              messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
            }
          }
        }
      }

      // Settle final message ID
      setMessages((prev) =>
        prev.map((m) => (m.id === streamingId ? { ...m, id: finalId } : m))
      );
    } catch {
      setError("Failed to send message");
      setMessages((prev) =>
        prev.filter((m) => m.id !== userMessage.id && m.id !== streamingId)
      );
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
    setSelectedMode("indexed"); // Reset to default mode
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

  function getDateLabel(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 6 * 86400000);
    const d = new Date(new Date(date).getFullYear(), new Date(date).getMonth(), new Date(date).getDate());
    if (d.getTime() === today.getTime()) return "Today";
    if (d.getTime() === yesterday.getTime()) return "Yesterday";
    if (d >= weekAgo) return "This week";
    return "Older";
  }

  const pinnedConvs = sortedConversations.filter(c => c.isPinned);
  const unpinnedConvs = sortedConversations.filter(c => !c.isPinned);
  const dateGroups = ["Today", "Yesterday", "This week", "Older"] as const;

  function ConvItem({ conv }: { conv: Conversation }) {
    return (
      <div
        className={cn(
          "group relative w-full text-left p-3 rounded-lg transition-all text-sm",
          selectedConversation === conv.id
            ? "bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800"
            : "hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent"
        )}
      >
        <button
          onClick={() => loadConversation(conv.id)}
          className="w-full text-left"
          title={conv.title}
        >
          <div className="font-medium text-sm truncate flex items-center gap-2 pr-12 mb-0.5">
            {conv.isPinned && <Pin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
            <FolderGit2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 shrink-0" />
            <span className="text-gray-900 dark:text-gray-200 truncate">{conv.title}</span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500 truncate pl-5.5">
            {conv.lastMessage || "No messages yet"}
          </div>
        </button>

        <div className="absolute right-2 top-3" ref={showMenuId === conv.id ? menuRef : null}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenuId(showMenuId === conv.id ? null : conv.id);
            }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all"
            title="More actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenuId === conv.id && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1">
              <button
                onClick={(e) => { e.stopPropagation(); openRenameDialog(conv.id); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Rename
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); togglePin(conv.id); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {conv.isPinned ? (
                  <><PinOff className="w-3.5 h-3.5" />Unpin</>
                ) : (
                  <><Pin className="w-3.5 h-3.5" />Pin</>
                )}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openDeleteDialog(conv.id); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] scrollbar-hide bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - Fixed 280px width on desktop, full width on mobile when active */}
      <div
        className={cn(
          "border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-col flex-shrink-0 md:w-72 md:flex",
          selectedConversation ? "hidden" : "flex w-full"
        )}
      >
        {/* New Chat Button */}
        <div className="px-3 min-h-[65px] flex items-center border-b border-gray-200 dark:border-gray-800">
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
            <div className="p-3 text-center text-gray-500 dark:text-gray-400">
              <div className="w-10 h-10 mx-auto mb-2 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-xs">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {pinnedConvs.length > 0 && (
                <>
                  <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Pinned</p>
                  {pinnedConvs.map((conv) => (
                    <ConvItem key={conv.id} conv={conv} />
                  ))}
                </>
              )}
              {dateGroups.map((label) => {
                const group = unpinnedConvs.filter(c => getDateLabel(new Date(c.updatedAt)) === label);
                if (group.length === 0) return null;
                return (
                  <div key={label}>
                    <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
                    {group.map((conv) => (
                      <ConvItem key={conv.id} conv={conv} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div
        className={cn(
          "relative flex-1 flex-col min-w-0 bg-gray-50 dark:bg-gray-900",
          !selectedConversation ? "hidden md:flex" : "flex"
        )}
      >
        {/* Mobile Header - Active Conversation */}
        {selectedConversation && (
          <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
            <button
              onClick={() => setSelectedConversation(null)}
              className="p-1 -ml-1 text-gray-600 dark:text-gray-400"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="font-medium truncate flex-1 text-gray-900 dark:text-white">
              {conversations.find(c => c.id === selectedConversation)?.title || "Chat"}
            </div>
          </div>
        )}

        {/* Header with Repo Selector and Mode - when creating new chat */}
        {!selectedConversation && repositories.length > 0 && (
          <div className="sticky top-0 z-50 flex items-center gap-3 px-6 min-h-[65px] border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-wrap">
            {/* Mode Selector */}
            <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <button
                onClick={() => setSelectedMode("indexed")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all",
                  selectedMode === "indexed"
                    ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                )}
                title="Smart Search - Uses AI to find relevant code chunks"
              >
                <Search className="w-3.5 h-3.5" />
                Smart
              </button>
              <button
                onClick={() => setSelectedMode("full_repo")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all",
                  selectedMode === "full_repo"
                    ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                )}
                title="Full Repo - Sends complete file list for broader understanding"
              >
                <FileText className="w-3.5 h-3.5" />
                Full
              </button>
            </div>

            {/* Selected Repo Display / Trigger */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowRepoDropdown(!showRepoDropdown)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                  selectedRepos.length > 0
                    ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-gray-700 dark:text-gray-200"
                    : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-400"
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
                <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 animate-dropdown">
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
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded text-xs text-indigo-700 dark:text-indigo-400"
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
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-10 py-6 pb-40 scrollbar-hide"
        >
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
              <span className="text-sm text-red-600 dark:text-red-400 flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {selectedConversation && messages.length === 0 && isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Loading conversation...</p>
              </div>
            </div>
          ) : messages.length === 0 && !selectedConversation ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-lg">
                <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Chat with your codebase</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Ask questions about your code, find specific functions, understand architecture.
                </p>
                {selectedRepos.length === 0 && repositories.length > 0 && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-500 dark:text-gray-400">
                    <FolderGit2 className="w-4 h-4" />
                    Select repositories to get started
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((message) => (
                <div key={message.id} className="animate-fade-in">
                  {/* User Question - HAS container */}
                  {message.role === "user" && (
                    <div className="max-w-3xl mx-auto my-6">
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-5 py-3 shadow-sm">
                        <p className="text-sm text-gray-800 dark:text-gray-200 text-left leading-relaxed">{message.content}</p>
                      </div>
                    </div>
                  )}

                  {/* AI Response - NO container, flows directly on background */}
                  {message.role === "assistant" && (
                    <div className="max-w-3xl mx-auto px-6">
                      <div className="text-[13px] text-gray-600 dark:text-gray-400 leading-relaxed space-y-4">
                        <MarkdownRenderer
                          content={message.content}
                          isStreaming={isLoading && message.id.startsWith("streaming-")}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && messages[messages.length - 1]?.content === "" && (
                <div className="max-w-3xl mx-auto px-6 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Scroll-to-bottom button */}
        {!isAtBottom && selectedConversation && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-36 right-8 z-40 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-md hover:shadow-lg hover:border-indigo-400 transition-all text-gray-500 hover:text-indigo-600"
            title="Scroll to bottom"
          >
            <ChevronsDown className="w-4 h-4" />
          </button>
        )}

        {/* Bottom Bar - Status + Input combined */}
        {selectedConversation && messages.length > 0 ? (
          <div className="fixed bottom-6 left-4 md:left-72 right-4 md:right-6 z-50">
            <div className="max-w-3xl mx-auto rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-0">
              {/* Status Bar */}
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-b-0 rounded-t-lg">
                {/* Left: Repository info & Mode badge */}
                <div className="flex items-center gap-3">
                  {/* Mode Badge */}
                  {(() => {
                    const currentConv = conversations.find((c) => c.id === selectedConversation);
                    const mode = currentConv?.mode || "indexed";
                    return (
                      <div
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
                          mode === "full_repo"
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                            : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
                        )}
                        title={mode === "full_repo" ? "Full Repo Mode - Complete context" : "Smart Mode - Relevant chunks"}
                      >
                        {mode === "full_repo" ? (
                          <>
                            <FileText className="w-3 h-3" />
                            Full
                          </>
                        ) : (
                          <>
                            <Search className="w-3 h-3" />
                            Smart
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {selectedRepos.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <FolderGit2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span className="truncate max-w-[200px] font-medium text-gray-700 dark:text-gray-300">
                        {selectedRepos.map(r => r.fullName).join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={copyMarkdown}
                    className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
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
                <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-b-lg shadow-sm">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (input.trim()) handleSubmit(e as unknown as React.FormEvent);
                      }
                    }}
                    placeholder="Ask a follow-up question... (Shift+Enter for new line)"
                    disabled={isLoading}
                    className="w-full px-5 py-4 pr-14 bg-transparent rounded-b-lg focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base leading-relaxed text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 resize-none overflow-hidden"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    <ArrowUp className="w-4 h-4 text-white" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* Input Area for New Chat */
          <div className="fixed bottom-6 left-4 md:left-72 right-4 md:right-6 z-50">
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
              <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-0">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim()) handleSubmit(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder={
                    selectedRepos.length > 0
                      ? "Ask about the codebase... (Shift+Enter for new line)"
                      : "Select repositories first"
                  }
                  disabled={isLoading || (!selectedConversation && selectedRepos.length === 0)}
                  className="w-full px-5 py-4 pr-14 bg-transparent rounded-lg focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base leading-relaxed text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 resize-none overflow-hidden"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim() || (!selectedConversation && selectedRepos.length === 0)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Rename Conversation</h3>
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={closeRenameDialog}
                disabled={isRenaming}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
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

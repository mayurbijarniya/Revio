import {
  AlertCircle,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  XCircle,
  Info,
  FileCode,
  GitPullRequest,
  Bot,
  Shield,
  Bug,
  Zap,
  BookOpen,
  Settings,
  User,
  LogOut,
  Plus,
  Search,
  Send,
  Loader2,
  Folder,
  File,
  Code,
  MessageSquare,
  Clock,
  Github,
  type LucideIcon,
} from "lucide-react";

/**
 * Severity level icons - NO EMOJIS
 */
export const SeverityIcon: Record<string, LucideIcon> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  suggestion: Lightbulb,
  info: Info,
};

/**
 * Severity level colors
 */
export const SeverityColor: Record<string, string> = {
  critical: "text-red-500",
  warning: "text-yellow-500",
  suggestion: "text-blue-500",
  info: "text-gray-500",
};

/**
 * Category icons for review issues
 */
export const CategoryIcon: Record<string, LucideIcon> = {
  security: Shield,
  bug: Bug,
  performance: Zap,
  best_practice: BookOpen,
};

/**
 * Status icons
 */
export const StatusIcon: Record<string, LucideIcon> = {
  success: CheckCircle,
  error: XCircle,
  pending: Loader2,
  approved: CheckCircle,
  changes_requested: AlertCircle,
};

/**
 * Risk level styles
 */
export const RiskLevelStyle: Record<string, string> = {
  low: "text-green-600 bg-green-50 border-green-200",
  medium: "text-yellow-600 bg-yellow-50 border-yellow-200",
  high: "text-orange-600 bg-orange-50 border-orange-200",
  critical: "text-red-600 bg-red-50 border-red-200",
};

/**
 * Common icons export
 */
export const Icons = {
  // Severity
  AlertCircle,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  XCircle,
  Info,

  // Files
  FileCode,
  File,
  Folder,
  Code,

  // Git
  GitPullRequest,
  Github,

  // Actions
  Plus,
  Search,
  Send,
  Settings,
  LogOut,

  // Status
  Loader2,
  Clock,

  // Categories
  Shield,
  Bug,
  Zap,
  BookOpen,

  // Other
  Bot,
  User,
  MessageSquare,
} as const;

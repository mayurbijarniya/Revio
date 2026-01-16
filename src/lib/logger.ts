/**
 * Centralized logging utility for Revio
 * Provides structured logging with different levels and context
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  userId?: string;
  repositoryId?: string;
  conversationId?: string;
  prReviewId?: string;
  organizationId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";
  private isProduction = process.env.NODE_ENV === "production";

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.message,
    ];

    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(`| Context: ${JSON.stringify(entry.context)}`);
    }

    if (entry.error) {
      parts.push(`| Error: ${entry.error.name}: ${entry.error.message}`);
      if (entry.error.stack && this.isDevelopment) {
        parts.push(`\nStack: ${entry.error.stack}`);
      }
    }

    return parts.join(" ");
  }

  /**
   * Create log entry object
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    if (context) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  /**
   * Send log to external service (e.g., Sentry, LogRocket, Datadog)
   */
  private async sendToExternalService(entry: LogEntry): Promise<void> {
    if (!this.isProduction) return;

    try {
      // TODO: Integrate with error tracking service
      // Example for Sentry:
      // if (entry.level === "error" && entry.error) {
      //   Sentry.captureException(new Error(entry.error.message), {
      //     level: "error",
      //     contexts: { context: entry.context },
      //   });
      // }

      // For now, just store critical errors in console
      if (entry.level === "error") {
        console.error("[PRODUCTION ERROR]", entry);
      }
    } catch (err) {
      console.error("Failed to send log to external service:", err);
    }
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    const entry = this.createLogEntry(level, message, context, error);
    const formattedMessage = this.formatLogEntry(entry);

    // Console output based on level
    switch (level) {
      case "debug":
        if (this.isDevelopment) {
          // eslint-disable-next-line no-console
          console.debug(formattedMessage);
        }
        break;
      case "info":
        // eslint-disable-next-line no-console
        console.info(formattedMessage);
        break;
      case "warn":
        console.warn(formattedMessage);
        break;
      case "error":
        console.error(formattedMessage);
        this.sendToExternalService(entry);
        break;
    }
  }

  /**
   * Debug level - detailed information for development
   */
  public debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  /**
   * Info level - general informational messages
   */
  public info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  /**
   * Warning level - potentially harmful situations
   */
  public warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  /**
   * Error level - error events that might still allow the app to continue
   */
  public error(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, context, error);
  }

  /**
   * Log API request
   */
  public apiRequest(
    method: string,
    path: string,
    context?: LogContext
  ): void {
    this.info(`API Request: ${method} ${path}`, context);
  }

  /**
   * Log API response
   */
  public apiResponse(
    method: string,
    path: string,
    status: number,
    duration?: number,
    context?: LogContext
  ): void {
    const message = `API Response: ${method} ${path} - ${status}${
      duration ? ` (${duration}ms)` : ""
    }`;

    if (status >= 500) {
      this.error(message, undefined, context);
    } else if (status >= 400) {
      this.warn(message, context);
    } else {
      this.info(message, context);
    }
  }

  /**
   * Log database query (development only)
   */
  public dbQuery(query: string, duration?: number): void {
    if (this.isDevelopment) {
      this.debug(
        `DB Query: ${query.substring(0, 100)}${query.length > 100 ? "..." : ""}${
          duration ? ` (${duration}ms)` : ""
        }`
      );
    }
  }

  /**
   * Log AI/LLM interaction
   */
  public aiInteraction(
    model: string,
    action: string,
    tokens?: number,
    context?: LogContext
  ): void {
    this.info(
      `AI Interaction: ${model} - ${action}${tokens ? ` (${tokens} tokens)` : ""}`,
      context
    );
  }

  /**
   * Log indexing operation
   */
  public indexing(
    repositoryId: string,
    status: "started" | "completed" | "failed",
    details?: {
      filesProcessed?: number;
      chunksCreated?: number;
      duration?: number;
      error?: string;
    }
  ): void {
    const message = `Indexing ${status} for repository ${repositoryId}`;

    if (status === "failed") {
      this.error(message, new Error(details?.error || "Unknown error"), {
        repositoryId,
        ...details,
      });
    } else {
      this.info(message, { repositoryId, ...details });
    }
  }

  /**
   * Log PR review operation
   */
  public prReview(
    repositoryId: string,
    prNumber: number,
    status: "started" | "completed" | "failed",
    details?: {
      issuesFound?: number;
      duration?: number;
      error?: string;
    }
  ): void {
    const message = `PR Review ${status} for PR #${prNumber} in repository ${repositoryId}`;

    if (status === "failed") {
      this.error(message, new Error(details?.error || "Unknown error"), {
        repositoryId,
        prNumber,
        ...details,
      });
    } else {
      this.info(message, { repositoryId, prNumber, ...details });
    }
  }

  /**
   * Log authentication events
   */
  public auth(
    event: "login" | "logout" | "token_refresh" | "auth_failure",
    userId?: string,
    details?: { provider?: string; error?: string }
  ): void {
    const message = `Auth: ${event}${userId ? ` for user ${userId}` : ""}`;

    if (event === "auth_failure") {
      this.warn(message, { userId, ...details });
    } else {
      this.info(message, { userId, ...details });
    }
  }
}

// Export singleton instance
export const logger = new Logger();

/**
 * Utility to measure execution time of async functions
 */
export async function withTiming<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const start = Date.now();
  logger.debug(`Starting: ${operation}`, context);

  try {
    const result = await fn();
    const duration = Date.now() - start;
    logger.debug(`Completed: ${operation} (${duration}ms)`, context);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(
      `Failed: ${operation} (${duration}ms)`,
      error as Error,
      context
    );
    throw error;
  }
}

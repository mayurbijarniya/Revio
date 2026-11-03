import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({ env: {}, requireEnv: () => "test" }));
vi.mock("./retriever", () => ({
  retrieveContext: vi.fn(),
  retrieveMultiRepoContext: vi.fn(),
  formatContextForPrompt: vi.fn(),
}));

const { mockStream } = vi.hoisted(() => ({ mockStream: vi.fn() }));
vi.mock("./gemini", () => ({ generateChatResponseStream: mockStream }));

import {
  FAILED_REPLY_TEXT,
  buildChatHistory,
  buildRetrievalQuery,
  isRepositoryChatReady,
  streamChatReply,
} from "./chat-service";

async function readEvents(response: Response): Promise<Array<Record<string, unknown>>> {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter((block) => block.startsWith("data: "))
    .map((block) => JSON.parse(block.slice(6)));
}

describe("chat history", () => {
  it("drops empty messages, merges same-role runs and starts with a user turn", () => {
    expect(
      buildChatHistory([
        { role: "assistant", content: "orphan reply" },
        { role: "user", content: "first" },
        { role: "user", content: "second" },
        { role: "assistant", content: "" },
        { role: "assistant", content: "answer" },
      ])
    ).toEqual([
      { role: "user", content: "first\n\nsecond" },
      { role: "model", content: "answer" },
    ]);
  });
});

describe("chat history with failed replies", () => {
  it("leaves failure notes out of the model history and strips the interrupted note", () => {
    expect(
      buildChatHistory([
        { role: "user", content: "first question" },
        { role: "assistant", content: FAILED_REPLY_TEXT },
        { role: "user", content: "asked again" },
        { role: "assistant", content: "partial answer\n\n_(Response interrupted. Please try again for the full answer.)_" },
      ])
    ).toEqual([
      { role: "user", content: "first question\n\nasked again" },
      { role: "model", content: "partial answer" },
    ]);
  });
});

describe("retrieval query", () => {
  it("keeps the previous topic for short follow-ups only", () => {
    expect(buildRetrievalQuery("what about the second one?", "how does auth work")).toBe(
      "how does auth work\nwhat about the second one?"
    );
    expect(buildRetrievalQuery("x".repeat(250), "previous")).toBe("x".repeat(250));
    expect(buildRetrievalQuery("question")).toBe("question");
  });
});

describe("chat readiness", () => {
  it("allows chatting while an existing index is being refreshed", () => {
    expect(isRepositoryChatReady({ indexStatus: "indexed", chunkCount: 0 })).toBe(true);
    expect(isRepositoryChatReady({ indexStatus: "indexing", chunkCount: 120 })).toBe(true);
    expect(isRepositoryChatReady({ indexStatus: "pending", chunkCount: 0 })).toBe(false);
  });
});

describe("streamChatReply", () => {
  it("streams chunks and saves the full reply", async () => {
    mockStream.mockResolvedValue({
      stream: (async function* () {
        yield { text: () => "Hello " };
        yield { text: () => "world" };
      })(),
    });
    const saveReply = vi.fn().mockResolvedValue("msg-1");

    const events = await readEvents(streamChatReply({ messages: [{ role: "user", content: "hi" }], saveReply }));

    expect(saveReply).toHaveBeenCalledWith("Hello world");
    expect(events.at(-1)).toEqual({ done: true, messageId: "msg-1", finalContent: "Hello world" });
  });

  it("saves a reply even when the model fails, so history never has an unanswered question", async () => {
    mockStream.mockRejectedValue(new Error("model down"));
    const saveReply = vi.fn().mockResolvedValue("msg-2");

    const events = await readEvents(streamChatReply({ messages: [{ role: "user", content: "hi" }], saveReply }));

    expect(saveReply).toHaveBeenCalledWith(FAILED_REPLY_TEXT);
    expect(events.at(-1)).toMatchObject({ done: true, messageId: "msg-2", finalContent: FAILED_REPLY_TEXT });
    expect(events.at(-1)?.error).toBeTruthy();
  });
});

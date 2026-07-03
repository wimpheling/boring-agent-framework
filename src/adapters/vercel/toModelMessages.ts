import {
  isRewriteEntry,
  type AssistantEntry,
  type AssistantStreamEntry,
  type SessionEntry,
  type ToolCallEntry,
  type ToolResultEntry,
  type UserEntry,
} from "../../session/entries.js";
import { resolveRewriteEntries, type Session } from "../../session/Session.js";

export type ModelToolCall = {
  readonly type: "tool-call";
  readonly toolCallId: string;
  readonly toolName: string;
  readonly input: unknown;
};

export type ModelToolResult = {
  readonly type: "tool-result";
  readonly toolCallId: string;
  readonly toolName: string;
  readonly output?: unknown;
  readonly error?: unknown;
};

export type ModelMessage =
  | { readonly role: "system"; readonly content: string }
  | { readonly role: "developer"; readonly content: string }
  | { readonly role: "user"; readonly content: string }
  | {
      readonly role: "assistant";
      readonly content: string;
      readonly toolCalls?: readonly ModelToolCall[];
    }
  | { readonly role: "tool"; readonly content: readonly ModelToolResult[] };

export type ToModelMessagesOptions = {
  readonly system?: string;
  readonly developer?: string;
  readonly applyRewriteCoverage?: boolean;
  readonly inProgressStreams?: "skip" | "current-content";
  readonly includeErroredStreams?: boolean;
};

export function toModelMessages(
  session: Session,
  options: ToModelMessagesOptions = {},
): ModelMessage[] {
  const prepared =
    options.applyRewriteCoverage === false ? session : resolveRewriteEntries(session);
  const messages: ModelMessage[] = [];

  if (options.system) {
    messages.push({ role: "system", content: options.system });
  }

  if (options.developer) {
    messages.push({ role: "developer", content: options.developer });
  }

  for (const entry of prepared.entries) {
    appendEntryMessage(messages, entry, options);
  }

  return messages;
}

function appendEntryMessage(
  messages: ModelMessage[],
  entry: SessionEntry,
  options: ToModelMessagesOptions,
): void {
  if (entry.kind === "user") {
    messages.push({ role: "user", content: (entry as UserEntry).payload.content });
    return;
  }

  if (entry.kind === "assistant") {
    messages.push({ role: "assistant", content: (entry as AssistantEntry).payload.content });
    return;
  }

  if (entry.kind === "assistant-stream") {
    appendStreamMessage(messages, entry as AssistantStreamEntry, options);
    return;
  }

  if (entry.kind === "tool-call") {
    appendToolCall(messages, entry as ToolCallEntry);
    return;
  }

  if (entry.kind === "tool-result") {
    appendToolResult(messages, entry as ToolResultEntry);
    return;
  }

  if (isRewriteEntry(entry)) {
    return;
  }
}

function appendStreamMessage(
  messages: ModelMessage[],
  entry: AssistantStreamEntry,
  options: ToModelMessagesOptions,
): void {
  if (entry.payload.status === "complete") {
    messages.push({ role: "assistant", content: entry.payload.content ?? "" });
    return;
  }

  if (entry.payload.status === "streaming" && options.inProgressStreams === "current-content") {
    messages.push({ role: "assistant", content: entry.payload.content ?? "" });
    return;
  }

  if (entry.payload.status === "error" && options.includeErroredStreams && entry.payload.content) {
    messages.push({ role: "assistant", content: entry.payload.content });
  }
}

function appendToolCall(messages: ModelMessage[], entry: ToolCallEntry): void {
  const toolCall: ModelToolCall = {
    type: "tool-call",
    toolCallId: entry.payload.toolCallId,
    toolName: entry.payload.toolName,
    input: entry.payload.input,
  };

  const previous = messages.at(-1);

  if (previous?.role === "assistant") {
    const toolCalls = [...(previous.toolCalls ?? []), toolCall];
    messages[messages.length - 1] = {
      ...previous,
      toolCalls,
    };
    return;
  }

  messages.push({
    role: "assistant",
    content: "",
    toolCalls: [toolCall],
  });
}

function appendToolResult(messages: ModelMessage[], entry: ToolResultEntry): void {
  const toolResult: ModelToolResult = {
    type: "tool-result",
    toolCallId: entry.payload.toolCallId,
    toolName: entry.payload.toolName,
    ...(entry.payload.output === undefined ? {} : { output: entry.payload.output }),
    ...(entry.payload.error === undefined ? {} : { error: entry.payload.error }),
  };

  const previous = messages.at(-1);

  if (previous?.role === "tool") {
    messages[messages.length - 1] = {
      role: "tool",
      content: [...previous.content, toolResult],
    };
    return;
  }

  messages.push({
    role: "tool",
    content: [toolResult],
  });
}

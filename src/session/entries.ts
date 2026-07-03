import type { JsonObject } from "../types.js";
import { serializeError, type SerializedError } from "../types.js";
import { cloneValue, deepFreeze } from "../utils/clone.js";
import { defaultIdGenerator, isoNow, type IdGenerator } from "../utils/id.js";
import type { SerializedSession } from "./serialize.js";
import type { TokenUsage } from "./tokenUsage.js";

export type SessionEntry<Kind extends string = string, Payload = unknown> = {
  readonly id: string;
  readonly kind: Kind;
  readonly createdAt: string;
  readonly payload: Payload;
  readonly tokenUsage?: TokenUsage;
  readonly metadata?: JsonObject;
};

export type EntryOptions = {
  readonly id?: string;
  readonly createdAt?: string | Date;
  readonly tokenUsage?: TokenUsage;
  readonly metadata?: JsonObject;
  readonly idGenerator?: IdGenerator;
};

export type UserPayload = {
  readonly content: string;
};

export type AssistantPayload = {
  readonly content: string;
};

export type StreamChunk = {
  readonly type: string;
  readonly text?: string;
  readonly value?: unknown;
  readonly metadata?: JsonObject;
};

export type AssistantStreamPayload = {
  readonly status: "streaming" | "complete" | "error";
  readonly chunks: readonly StreamChunk[];
  readonly content?: string;
  readonly error?: SerializedError;
};

export type ToolCallPayload = {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly input: unknown;
};

export type ToolResultPayload = {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly output?: unknown;
  readonly error?: SerializedError;
};

export type RewriteCoverage = {
  readonly type: "range";
  readonly fromEntryId: string;
  readonly toEntryId: string;
};

export type RewritePayload = {
  readonly rewriterName: string;
  readonly inputSessionId?: string;
  readonly outputSession: SerializedSession;
  readonly coverage?: RewriteCoverage;
};

export type UserEntry = SessionEntry<"user", UserPayload>;
export type AssistantEntry = SessionEntry<"assistant", AssistantPayload>;
export type AssistantStreamEntry = SessionEntry<"assistant-stream", AssistantStreamPayload>;
export type ToolCallEntry = SessionEntry<"tool-call", ToolCallPayload>;
export type ToolResultEntry = SessionEntry<"tool-result", ToolResultPayload>;
export type RewriteEntry = SessionEntry<"rewrite", RewritePayload>;

export type BuiltInEntry =
  | UserEntry
  | AssistantEntry
  | AssistantStreamEntry
  | ToolCallEntry
  | ToolResultEntry
  | RewriteEntry;

export function createEntry<Kind extends string, Payload>(
  kind: Kind,
  payload: Payload,
  options: EntryOptions = {},
): SessionEntry<Kind, Payload> {
  const idGenerator = options.idGenerator ?? defaultIdGenerator;
  const createdAt =
    options.createdAt instanceof Date
      ? options.createdAt.toISOString()
      : (options.createdAt ?? isoNow());

  return deepFreeze({
    id: options.id ?? idGenerator(),
    kind,
    createdAt,
    payload: cloneValue(payload),
    ...(options.tokenUsage ? { tokenUsage: cloneValue(options.tokenUsage) } : {}),
    ...(options.metadata ? { metadata: cloneValue(options.metadata) } : {}),
  });
}

export function userEntry(content: string | UserPayload, options?: EntryOptions): UserEntry {
  return createEntry("user", typeof content === "string" ? { content } : content, options);
}

export function assistantEntry(
  content: string | AssistantPayload,
  options?: EntryOptions,
): AssistantEntry {
  return createEntry("assistant", typeof content === "string" ? { content } : content, options);
}

export function assistantStreamEntry(
  payload: Partial<AssistantStreamPayload> = {},
  options?: EntryOptions,
): AssistantStreamEntry {
  return createEntry(
    "assistant-stream",
    {
      status: payload.status ?? "streaming",
      chunks: payload.chunks ?? [],
      ...(payload.content === undefined ? {} : { content: payload.content }),
      ...(payload.error === undefined ? {} : { error: payload.error }),
    },
    options,
  );
}

export function appendAssistantStreamChunk(
  entry: AssistantStreamEntry,
  chunk: StreamChunk,
  options: Pick<EntryOptions, "tokenUsage" | "metadata"> = {},
): AssistantStreamEntry {
  const contentDelta = chunk.text ?? "";

  return {
    ...entry,
    payload: deepFreeze({
      ...entry.payload,
      chunks: [...entry.payload.chunks, cloneValue(chunk)],
      content: `${entry.payload.content ?? ""}${contentDelta}`,
    }),
    ...(options.tokenUsage ? { tokenUsage: cloneValue(options.tokenUsage) } : {}),
    ...(options.metadata ? { metadata: cloneValue(options.metadata) } : {}),
  };
}

export function completeAssistantStream(
  entry: AssistantStreamEntry,
  options: Pick<EntryOptions, "tokenUsage" | "metadata"> & { readonly content?: string } = {},
): AssistantStreamEntry {
  return {
    ...entry,
    payload: deepFreeze({
      ...entry.payload,
      status: "complete",
      content: options.content ?? entry.payload.content ?? "",
    }),
    ...(options.tokenUsage ? { tokenUsage: cloneValue(options.tokenUsage) } : {}),
    ...(options.metadata ? { metadata: cloneValue(options.metadata) } : {}),
  };
}

export function failAssistantStream(
  entry: AssistantStreamEntry,
  error: unknown,
  options: Pick<EntryOptions, "tokenUsage" | "metadata"> = {},
): AssistantStreamEntry {
  return {
    ...entry,
    payload: deepFreeze({
      ...entry.payload,
      status: "error",
      error: serializeError(error),
    }),
    ...(options.tokenUsage ? { tokenUsage: cloneValue(options.tokenUsage) } : {}),
    ...(options.metadata ? { metadata: cloneValue(options.metadata) } : {}),
  };
}

export function toolCallEntry(payload: ToolCallPayload, options?: EntryOptions): ToolCallEntry {
  return createEntry("tool-call", payload, options);
}

export function toolResultEntry(
  payload: ToolResultPayload,
  options?: EntryOptions,
): ToolResultEntry {
  return createEntry("tool-result", payload, options);
}

export function rewriteEntry(payload: RewritePayload, options?: EntryOptions): RewriteEntry {
  return createEntry("rewrite", payload, options);
}

export function isRewriteEntry(entry: SessionEntry): entry is RewriteEntry {
  return entry.kind === "rewrite" && typeof entry.payload === "object" && entry.payload !== null;
}

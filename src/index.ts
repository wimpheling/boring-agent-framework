export type { JsonObject, JsonPrimitive, JsonValue, MaybePromise, SerializedError } from "./types";
export { serializeError } from "./types";

export type { IdGenerator } from "./utils/id";
export { defaultIdGenerator } from "./utils/id";

export type {
  AssistantEntry,
  AssistantPayload,
  AssistantStreamEntry,
  AssistantStreamPayload,
  BuiltInEntry,
  EntryOptions,
  RewriteCoverage,
  RewriteEntry,
  RewritePayload,
  SessionEntry,
  StreamChunk,
  ToolCallEntry,
  ToolCallPayload,
  ToolResultEntry,
  ToolResultPayload,
  UserEntry,
  UserPayload,
} from "./session/entries";
export {
  appendAssistantStreamChunk,
  assistantEntry,
  assistantStreamEntry,
  completeAssistantStream,
  createEntry,
  failAssistantStream,
  isRewriteEntry,
  rewriteEntry,
  toolCallEntry,
  toolResultEntry,
  userEntry,
} from "./session/entries";

export type { SerializedSession, SessionVersion } from "./session/serialize";
export {
  resolveRewriteEntries,
  Session,
  SessionBuilder,
  type BuildSession,
  type SessionOptions,
} from "./session/Session";

export type { SessionTokenSummary, TokenUsage } from "./session/tokenUsage";
export { addTokenUsage, normalizeTokenUsage, sumEntryTokenUsage } from "./session/tokenUsage";

export type {
  ApplyRewriterResult,
  ModelContext,
  RewriteInput,
  RewriteOutput,
  RewriteTraceOptions,
  Rewriter,
} from "./rewriter/Rewriter";
export { applyRewriter, runRewriter } from "./rewriter/Rewriter";

export type { Instructions, Routine, RoutineContext, RoutineRunResult } from "./routine/Routine";

export type {
  ModelMessage,
  ModelToolCall,
  ModelToolResult,
  ToModelMessagesOptions,
} from "./adapters/vercel/toModelMessages";
export { toModelMessages } from "./adapters/vercel/toModelMessages";

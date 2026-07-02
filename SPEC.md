# Boring Agent Framework Bootstrap Specification

Status: Draft  
Package name: `boring-agent-framework`  
Version target: experimental `0.0.x`  
Runtime target: browser-compatible TypeScript  
Primary foundation: Vercel AI SDK

## 1. Purpose

**Boring Agent Framework** is a small TypeScript framework for building LLM-powered programs on top of the Vercel AI SDK.

BAF uses the industry word “agent,” but its primitives are sessions, routines, and rewrites.

It is not a batteries-included runtime for autonomous software.

It does not own the loop.

It does not prescribe a planning strategy, memory model, tool execution policy, retry behavior, or context-management policy.

Instead, it provides boring, explicit, inspectable primitives for developers who want to build their own LLM-powered software as ordinary TypeScript programs.

The guiding principles are:

> Agents are just programs.
>
> Own the loop.

BAF exists to make the surrounding structure of an LLM-powered program boring, typed, serializable, measurable, browser-compatible, and easy to reason about.

The LLM can be probabilistic. The program around it should not be mysterious.

## 2. Non-goals

BAF should avoid becoming a high-level orchestration framework.

In particular, BAF should not initially provide:

- a built-in autonomous loop;
- a LangChain-style chain abstraction;
- a graph runtime;
- a required memory strategy;
- a required persistence layer;
- a required tool execution engine;
- a required planning abstraction;
- a hidden context compression policy;
- implicit retries;
- implicit parallelism;
- implicit background behavior.

A basic tool-calling loop may be provided as an example, but it must not be treated as a core primitive.

## 3. Relationship with the Vercel AI SDK

BAF is built on top of the Vercel AI SDK.

The Vercel AI SDK already provides the model-facing primitives:

- `generateText`;
- `streamText`;
- `generateObject`;
- tools;
- tool calls;
- model adapters;
- structured output;
- streaming;
- provider interoperability.

BAF should not replace these APIs.

Instead, BAF should provide primitives around them:

- sessions;
- session entries;
- workflow entries;
- rewriters;
- token accounting;
- explicit context construction;
- functional routine shapes;
- helper utilities for converting BAF session state into Vercel AI SDK-compatible inputs.

For the initial version, BAF should mirror the Vercel AI SDK’s modelization where practical.

This means BAF can use Vercel-style concepts for:

- messages;
- roles;
- tool calls;
- tool results;
- model input preparation;
- streams.

Open concern:

> Should BAF depend directly on the Vercel AI SDK types, or should it define compatible local types and expose adapters?

Initial answer:

For `0.0.x`, direct alignment with Vercel AI SDK types is acceptable. The framework’s purpose is to complement that SDK, not to be provider-agnostic from day one.

However, BAF should avoid wrapping the SDK so heavily that users feel like they are using a different LLM API.

## 4. Runtime compatibility

BAF should be browser-compatible.

This implies:

- no Node-only APIs in core;
- no direct filesystem dependency;
- no direct process/env dependency;
- no required storage adapter;
- no required server runtime;
- no use of Node-specific crypto unless polyfilled or abstracted;
- no hard dependency on terminal behavior.

Core package code should work in:

- browsers;
- Node.js;
- edge runtimes;
- workers, where possible.

Examples may target Node.js if they demonstrate CLI coding-assistant behavior, but core primitives should remain runtime-neutral.

## 5. Package identity

The package name should be:

```txt
boring-agent-framework
```

Possible import style:

```ts
import {
  Session,
  Rewriter,
  userEntry,
  assistantEntry,
  toolCallEntry,
  toolResultEntry,
  rewriteEntry,
  toModelMessages,
} from "boring-agent-framework"
```

The project should start as an experimental `0.0.x` package.

API stability is not guaranteed initially.

The early goal is to discover the right primitive shapes, not to prematurely freeze abstractions.

## 6. Core concepts

BAF initially revolves around these core concepts:

1. `Session`;
2. `SessionEntry`;
3. `Rewriter`;
4. `Routine`;
5. token accounting.

The framework should make session state, workflow state, and token payload visible rather than implicit.

## 7. Session

A `Session` is the primary state object in BAF.

It represents the ordered history of an LLM-powered routine’s execution.

A session is not just a chat transcript. It may contain user messages, assistant messages, tool calls, tool results, workflow events, rewrites, token accounting, stream events, and custom user-defined entries.

A session should be:

- ordered;
- typed;
- immutable by default;
- serializable;
- inspectable;
- extensible;
- safe to convert into model input;
- able to account for token usage.

A session should not be tied to a storage backend.

Persistence is the user’s responsibility.

BAF should provide serialization helpers or make the object naturally JSON-serializable.

## 8. Session entries

A `Session` contains a list of `SessionEntry` objects.

A session entry is an event-like item in the lifecycle of a routine execution.

Initial built-in entry kinds:

- user message;
- assistant message;
- tool call;
- tool result;
- rewrite result / workflow rewrite;
- streaming assistant message or stream event;
- possibly model response metadata.

System/developer instructions are important, but they should probably be outside the session as routine configuration or model-call context. Rewriters should still be able to see and rewrite them when preparing model input.

The entry system should be extensible.

BAF should not assume that built-in entries are the only possible session entries.

A possible base shape:

```ts
type SessionEntry<
  Kind extends string = string,
  Payload = unknown,
> = {
  id: string
  kind: Kind
  createdAt: string
  payload: Payload
  tokenUsage?: TokenUsage
  metadata?: JsonObject
}
```

`createdAt` should probably be represented as an ISO string rather than a `Date` object if JSON serialization is a first-class concern.

If richer runtime objects are desired, BAF can expose helper constructors that accept or produce `Date`, but the stored representation should remain JSON-safe.

## 9. Built-in entry examples

### User entry

Represents user input.

```ts
type UserEntry = SessionEntry<"user", {
  content: string
}>
```

### Assistant entry

Represents a finalized assistant/model response.

```ts
type AssistantEntry = SessionEntry<"assistant", {
  content: string
}>
```

Naming recommendation:

Use `assistant`, not `agent`, for model-message entries because it mirrors Vercel/OpenAI terminology.

Use BAF vocabulary for workflow concepts such as `Session`, `Rewriter`, and `Routine`.

### Streaming assistant entry

Represents assistant output produced through streaming.

The exact shape is open, but the framework should support the fact that BAF is built over Vercel AI SDK and users should be able to access streaming state naturally.

Possible shape:

```ts
type AssistantStreamEntry = SessionEntry<"assistant-stream", {
  status: "streaming" | "complete" | "error"
  chunks: StreamChunk[]
  content?: string
  error?: SerializedError
}>
```

This should be revisited during implementation.

### Tool call entry

Represents a requested tool call.

Tool calls should have their own entries.

```ts
type ToolCallEntry = SessionEntry<"tool-call", {
  toolCallId: string
  toolName: string
  input: unknown
}>
```

### Tool result entry

Represents a tool result.

```ts
type ToolResultEntry = SessionEntry<"tool-result", {
  toolCallId: string
  toolName: string
  output?: unknown
  error?: SerializedError
}>
```

### Rewrite entry

Represents an explicit rewrite of context.

```ts
type RewriteEntry = SessionEntry<"rewrite", {
  rewriterName: string
  inputSessionId?: string
  outputSession: SerializedSession
}>
```

This shape reflects an important design possibility: a rewriter may return a new `Session` object rather than a small rewrite payload.

See the rewriter and rewrite coverage sections.

## 10. Immutability

The default `Session` API should be immutable.

Target audience:

- developers;
- control freaks;
- people who want explicit state;
- people who want testable LLM-powered logic;
- people who prefer regular programming patterns over hidden runtime behavior.

An immutable session is a strong identity choice for BAF.

Benefits:

- easier testing;
- easier replay;
- easier snapshots;
- easier undo/fork behavior;
- fewer hidden side effects;
- better compatibility with functional state machines;
- safer resumability;
- easier debugging;
- better browser/state-management compatibility.

Example immutable API:

```ts
let session = Session.empty()

session = session.append(userEntry("Hello"))
session = session.append(assistantEntry("Hi!"))
```

or:

```ts
const session = Session.empty()
  .append(userEntry("Hello"))
  .append(assistantEntry("Hi!"))
```

If the API is immutable, methods like `append` must return a new `Session`.

They must not mutate the existing session.

```ts
const nextSession = session.append(entry)
```

Potential shape:

```ts
class Session {
  readonly entries: readonly SessionEntry[]

  append(entry: SessionEntry): Session
  appendMany(entries: readonly SessionEntry[]): Session
  replaceEntry(id: string, entry: SessionEntry): Session
  removeEntry(id: string): Session
  toJSON(): SerializedSession
  static fromJSON(value: SerializedSession): Session
}
```

### Mutable adapter / builder

A mutable adapter may still be useful for ergonomic loops, but it should not become the central model.

Many LLM-powered loops are naturally written as step-by-step procedures:

```ts
const draft = Session.builder(session)

draft.append(userEntry(prompt))

const nextSession = draft.build()
```

Possible API:

```ts
session = session.build((draft) => {
  draft.append(assistantEntry(result.text))

  for (const toolCall of result.toolCalls) {
    draft.append(toolCallEntry(toolCall))
  }
})
```

Naming options:

- `SessionBuilder`;
- `SessionDraft`;
- `SessionWriter`.

Recommendation:

Use `SessionBuilder` or `SessionDraft` rather than `MutableSession`.

`MutableSession` sounds like a parallel first-class model.

`SessionBuilder` communicates that mutation is a local convenience for producing an immutable session.

Initial recommendation:

- `Session` is immutable;
- a builder/draft is short-lived;
- long-lived routine state is always a `Session`;
- routines return the next session or context rather than mutating hidden state.

## 11. Serialization

Sessions should be serializable.

There should be no required storage adapter in the initial version.

The core guarantee should be:

> A session can be converted to JSON and restored without losing framework-level meaning.

Possible API:

```ts
const json = session.toJSON()
const restored = Session.fromJSON(json)
```

The serialized format should be explicit and versioned:

```ts
type SerializedSession = {
  version: "0.0"
  id: string
  entries: SessionEntry[]
  tokenUsage?: TokenUsage
  metadata?: JsonObject
}
```

Open question:

Should entry IDs be generated by BAF, or must the caller provide them?

Recommendation:

BAF can provide helper constructors that generate IDs, but all constructors should accept explicit IDs.

Because browser compatibility matters, implementation should use portable APIs such as `crypto.randomUUID()` when available, with an overridable fallback or user-provided IDs.

## 12. Token tracking

Token tracking should be first-class.

BAF does not need to provide full token management at first.

That means BAF does not initially need to decide:

- when to compact;
- when to summarize;
- what to drop;
- what model-specific tokenizer to use;
- how to optimize context windows;
- whether to enforce a budget.

However, sessions and entries should be designed so token accounting can be recorded and inspected.

A session should be able to report:

1. current token payload;
2. total token payload.

### Current token payload

The approximate or exact token count that would be sent to the model for the current prepared context.

This should respect rewriters.

For example, if a rewriter summarizes ten old messages into one compact message, the current token payload should count the compacted representation, not the hidden raw messages.

### Total token payload

The cumulative token weight of the entire session history, including raw entries and rewriter activity.

This is useful for:

- cost accounting;
- debugging;
- telemetry;
- understanding how much work the routine has performed;
- comparing compaction strategies.

A possible type:

```ts
type TokenUsage = {
  input?: number
  output?: number
  total?: number
  source?: "exact" | "estimated" | "provider-reported" | string
  model?: string
  metadata?: JsonObject
}
```

At the session level:

```ts
type SessionTokenSummary = {
  current: TokenUsage
  total: TokenUsage
}
```

Possible API:

```ts
const summary = session.getTokenSummary()
```

Open design issue:

Token counts may be:

- exact provider-reported usage;
- estimated by a tokenizer;
- computed from model input conversion;
- manually supplied by user code.

Therefore BAF should not pretend all token counts are equally precise.

Initial recommendation:

Use a pragmatic `TokenUsage` object with optional source metadata.

Do not include tokenizer logic initially. Store and aggregate token usage. Add tokenizer adapters later if useful.

## 13. Rewriters

A `Rewriter` is an explicit workflow component.

It transforms previous context into another representation.

A rewriter is not hidden memory.

A rewriter should appear in the session or in the resulting workflow trace as an explicit entry.

This is central to BAF’s philosophy: context management should be inspectable and debuggable.

There are two important possible models.

### Option A: rewriter returns rewrite output

```ts
interface Rewriter<Input = RewriteInput, Output = RewriteResult> {
  readonly name: string
  rewrite(input: Input): Promise<Output> | Output
}
```

Where:

```ts
type RewriteResult = {
  entries: SessionEntry[]
  tokenUsage?: TokenUsage
  metadata?: JsonObject
}
```

This means the rewriter returns entries that replace or summarize part of the context.

### Option B: rewriter returns a new Session

```ts
interface Rewriter {
  readonly name: string
  rewrite(input: RewriteInput): Promise<Session> | Session
}
```

This matches the immutable session pattern.

A rewriter receives a session-like context and returns a new session object.

For a compactor, the returned session might contain only one compacted assistant/system-like message plus recent entries. For another rewriter, it might apply its own logic:

- redact some entries;
- summarize old tool results;
- preserve user messages;
- transform raw transcript into state;
- split or merge entries;
- reorder model-visible context if explicitly desired;
- remove sensitive data from model context while preserving audit metadata elsewhere.

Benefits:

- aligns with immutable design;
- very general;
- lets rewriters own their own logic;
- avoids over-designing `RewriteCoverage` too early;
- easy to test: input session in, output session out.

Risks:

- may make it harder to preserve an audit trail unless rewrite entries record the transformation;
- can blur the distinction between true historical session and model-visible context session;
- may require naming two different concepts: actual session history vs prepared/re rewritten session.

Initial direction:

This is promising and should be discussed further before implementation.

One possible compromise:

- the durable/original `Session` remains an append-only-ish history;
- a `Rewriter` returns a derived `Session` for model input;
- the original session records a `rewrite` entry containing metadata and/or serialized output session;
- `toModelMessages` can accept either the original session with rewrite entries or an already-rewritten derived session.

## 14. Compactors

A `Compactor` is a common kind of `Rewriter`.

It reduces previous context into a smaller representation.

Possible compactors:

- transcript summarizer;
- tool-result summarizer;
- state extractor;
- codebase state summarizer;
- “latest facts only” reducer;
- redactor;
- compression by model call.

But `Compactor` should not be the core abstraction.

The core abstraction is `Rewriter`.

A compactor is just one implementation.

## 15. Rewrite coverage

This is an important open design question.

Earlier design assumed a rewrite needs to indicate which previous session entries it replaces or hides during model input construction.

However, if a rewriter simply returns a new `Session` object, explicit coverage may be less central.

### Model A: explicit coverage

A rewrite entry says which previous entries it covers.

Possible shape:

```ts
type RewriteCoverage = {
  type: "range"
  fromEntryId: string
  toEntryId: string
}
```

Meaning:

> For future model input, entries from `fromEntryId` through `toEntryId` should not be sent raw. Use this rewrite output instead.

Benefits:

- simple audit trail;
- explicit semantics;
- easy to inspect;
- easy to explain token accounting.

Drawbacks:

- requires designing coverage rules;
- may be too rigid;
- can become awkward for custom rewriting logic.

### Model B: rewriter returns a derived Session

The rewriter owns the transformation and returns the exact session that should be used for model input.

For example, a compactor can return a session containing one compacted message plus recent messages.

Benefits:

- matches immutable pattern;
- maximally flexible;
- simpler rewriter interface;
- avoids forcing all rewriters into range/entry coverage semantics.

Drawbacks:

- need to distinguish durable session from derived model-input session;
- overlapping rewrite semantics may move from framework rules into user code;
- token accounting must know which session is being counted;
- auditability requires care.

### Current open question

Should BAF model rewrites as:

1. entries with explicit coverage; or
2. pure `Session -> Session` transformations; or
3. both, with explicit rewrite entries recording the transformation result?

Initial leaning:

Explore the `Session -> Session` model because it fits the immutable identity of the framework.

Do not finalize rewrite coverage until this is discussed more.

## 16. Context construction

Context construction is the process of turning session-like state into model input.

BAF should provide helpers for turning a `Session` into Vercel AI SDK-compatible messages.

Possible names:

```ts
toModelMessages(session)
```

or:

```ts
prepareModelMessages(session)
```

or:

```ts
session.toModelMessages()
```

Recommendation:

Prefer a standalone helper:

```ts
const messages = toModelMessages(session)
```

Why?

- keeps `Session` as a data structure;
- avoids making the session object feel like an AI SDK wrapper;
- allows multiple adapters later;
- allows options to be passed explicitly.

However, the exact semantics are still open, especially if rewriters return derived sessions.

Open questions:

- Does `toModelMessages` apply rewriters itself, or only convert an already-prepared session?
- Are system/developer instructions passed separately?
- Can rewriters rewrite system/developer instructions even though they are outside the session?
- Should context construction return messages only, or also token accounting and trace metadata?
- How should streaming/in-progress assistant entries be represented in model input?
- If rewriters return new sessions, should `toModelMessages` accept only the final derived session?

Initial constraint:

Context construction must be explicit. It should not hide a complex memory engine behind a friendly helper.

## 17. Overlapping rewrites

If BAF supports rewrite entries with coverage, overlapping rewrites must be deterministic.

Decision:

> Latest rewrite wins.

Example:

```txt
1 User
2 Assistant
3 Rewrite covers 1-2
4 User
5 Assistant
6 Rewrite covers 1-5
```

In this case, the rewrite at entry 6 wins for its covered range.

Rules if explicit coverage is used:

1. A rewrite can only cover entries before itself.
2. During context construction, rewrites are applied in session order.
3. Later rewrites can cover earlier rewrites.
4. The latest covering rewrite determines what is visible for its range.
5. Raw covered entries are still preserved in the durable session.

If the `Session -> Session` rewriter model is used, overlapping rewrite behavior may become a property of user-authored rewriter composition rather than a framework-level coverage algorithm.

## 18. Routines and executable abstractions

A functional style is preferred.

BAF may not need a class-based `AbstractAgent` at all. In fact, the core API should avoid treating “agents” as special entities.

The key idea is that a routine receives explicit input and explicit context, then returns explicit output and the next context.

An “agent” is just one possible userland pattern built from routines, sessions, rewrites, model calls, and ordinary TypeScript control flow.

Possible functional shape:

```ts
type RoutineRunResult<TOutput, TContext extends RoutineContext = RoutineContext> = {
  output: TOutput
  context: TContext
}

type RoutineContext<TSession extends Session = Session> = {
  session: TSession
  instructions?: Instructions
  metadata?: JsonObject
}

type Routine<
  TInput = unknown,
  TOutput = unknown,
  TContext extends RoutineContext = RoutineContext,
> = (
  input: TInput,
  context: TContext,
) => Promise<RoutineRunResult<TOutput, TContext>> | RoutineRunResult<TOutput, TContext>
```

Example:

```ts
const routine: Routine<string, string> = async (prompt, context) => {
  let session = context.session.append(userEntry(prompt))

  const result = await generateText({
    model,
    messages: toModelMessages(session),
  })

  session = session.append(assistantEntry(result.text))

  return {
    output: result.text,
    context: {
      ...context,
      session,
    },
  }
}
```

A class can still be useful for developers who want inheritance or shared dependencies, but it should not be the conceptual center of the framework.

Open question:

Should BAF provide a thin optional class wrapper later?

Initial recommendation:

Start with the functional `Routine` type only.

Do not include `AbstractAgent` in the MVP unless a concrete need appears.

## 19. Basic loop example

The default loop should not be a primitive.

It should live in `examples`.

Possible example name:

```txt
examples/own-the-loop
```

or:

```txt
examples/basic-tool-loop
```

The example should demonstrate:

1. append user input to a session;
2. call `generateText` or `streamText`;
3. append assistant response or streaming response entries;
4. inspect tool calls;
5. execute tools in user code;
6. append tool results;
7. repeat until no tool calls or max steps.

Pseudo-code:

```ts
let session = Session.empty().append(userEntry(prompt))

for (let step = 0; step < maxSteps; step++) {
  const result = await generateText({
    model,
    messages: toModelMessages(session),
    tools,
  })

  session = session.append(assistantEntry({
    content: result.text,
    tokenUsage: result.usage,
  }))

  if (result.toolCalls.length === 0) {
    break
  }

  for (const toolCall of result.toolCalls) {
    session = session.append(toolCallEntry(toolCall))

    const output = await executeTool(toolCall)

    session = session.append(toolResultEntry({
      toolCall,
      output,
    }))
  }
}
```

Documentation should explicitly say:

> This is example code. It is not BAF behavior. Copy it, modify it, delete it. The loop is yours.

## 20. Streaming

Streaming should be treated seriously because BAF is built over the Vercel AI SDK, and users should be able to get current streams easily.

The first design instinct was to store only finalized assistant messages.

That is simpler, but probably too weak for a framework that wants to expose routine state clearly.

BAF should consider supporting both:

1. non-streaming finalized assistant messages;
2. streaming assistant messages / stream lifecycle entries.

Potential models:

### Option A: finalized messages only

During streaming, user code consumes chunks. Once complete, it appends a final assistant entry.

Benefits:

- simple;
- serializable;
- avoids noisy sessions;
- easy context construction.

Drawbacks:

- cannot replay stream-level behavior;
- loses partial output telemetry;
- does not expose current stream state through BAF.

### Option B: stream chunks as entries

Each chunk becomes a session entry.

Benefits:

- complete event log;
- useful for debugging streaming behavior;
- naturally exposes current stream state.

Drawbacks:

- noisy;
- large sessions;
- complex conversion to model input.

### Option C: streaming assistant entry with chunk history

One assistant stream entry contains lifecycle state and chunk history.

Possible shape:

```ts
type AssistantStreamEntry = SessionEntry<"assistant-stream", {
  status: "streaming" | "complete" | "error"
  chunks: StreamChunk[]
  content?: string
  error?: SerializedError
}>
```

Benefits:

- preserves stream detail without polluting the top-level session with every chunk;
- current stream state can be inspected;
- final content can be derived or stored;
- maps to browser UI state better than finalized-only messages.

Drawbacks:

- more complex entry updates;
- immutable updates to streaming entries need careful API design;
- token accounting may be partial until stream completion.

Initial recommendation:

Do the harder design work and support streaming and non-streaming assistant messages.

Do not finalize the exact stream entry shape yet.

Open questions:

- Is a streaming entry updated immutably via `replaceEntry`?
- Should chunks be stored by default, or should BAF store only current content and optional chunk metadata?
- How closely should `StreamChunk` mirror Vercel AI SDK stream parts?
- How should token usage be attached during a stream before provider usage is available?

## 21. Tool representation

BAF should mirror Vercel AI SDK tool calls/results for now.

This does not mean BAF must execute tools.

Tool execution belongs to the user’s loop.

Tool calls should have their own entries.

BAF should provide entry constructors that make it easy to record:

- tool call ID;
- tool name;
- tool input;
- tool output;
- tool error;
- token usage if relevant;
- metadata.

Possible shapes:

```ts
type ToolCallPayload = {
  toolCallId: string
  toolName: string
  input: unknown
}

type ToolResultPayload = {
  toolCallId: string
  toolName: string
  output?: unknown
  error?: SerializedError
}
```

Recommendation:

Use separate session entries for tool calls and tool results, while allowing assistant entries to retain raw provider/model metadata if useful.

For conversion back to Vercel-compatible model messages, BAF can group entries as needed.

## 22. System and developer messages

System/developer instructions should probably be outside the session.

Reasoning:

- they are often routine or application configuration rather than conversation history;
- multiple sessions may share the same system/developer instructions;
- storing them in every session may duplicate data;
- keeping them separate clarifies the difference between durable session state and routine/application configuration.

However, rewriters should be able to rewrite them.

This implies context construction may need an explicit context object, not only a session.

Possible shape:

```ts
type ModelContext = {
  system?: string
  developer?: string
  session: Session
}
```

or:

```ts
type ContextSource = {
  system?: ModelInstruction[]
  session: Session
}
```

Then a rewriter can receive both instructions and session:

```ts
type RewriteInput = {
  system?: string
  developer?: string
  session: Session
}
```

Open question:

If a rewriter changes system/developer instructions, where is that recorded?

Possible answers:

1. in a rewrite entry in the session;
2. in a separate context trace;
3. by returning a full rewritten model context rather than only a session.

This suggests that `Rewriter` may eventually be better modeled as:

```ts
type Rewriter = (input: ModelContext) => Promise<ModelContext> | ModelContext
```

rather than only:

```ts
type Rewriter = (session: Session) => Promise<Session> | Session
```

This requires further discussion.

## 23. Metadata and observability

Session entries should support metadata.

This allows user code to record things like:

- model name;
- provider;
- latency;
- retry count;
- cost estimate;
- cache hit/miss;
- tool duration;
- error classification;
- source file;
- user ID;
- trace ID;
- custom app state.

Metadata should be plain JSON-compatible data.

Possible type:

```ts
type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

type JsonObject = { [key: string]: JsonValue }
```

Then:

```ts
metadata?: JsonObject
```

This improves serialization discipline.

Observability should be explicit and user-controlled.

BAF should not secretly phone home, collect traces, or require a telemetry backend.

## 24. JSON compatibility

Because browser compatibility and serialization matter, core session data should be JSON-compatible.

Avoid storing:

- functions;
- class instances;
- `Date` objects;
- `Map`;
- `Set`;
- symbols;
- promises;
- errors directly;
- provider-specific opaque objects that are not serializable.

For errors, provide a serializable error shape:

```ts
type SerializedError = {
  name?: string
  message: string
  stack?: string
  cause?: unknown
  metadata?: JsonObject
}
```

For dates, use ISO strings.

For arbitrary payloads, type them as JSON-compatible where possible.

Open question:

Should BAF strictly enforce JSON-serializable payloads at the type level?

Possible approach:

```ts
type SessionEntry<
  Kind extends string = string,
  Payload extends JsonValue = JsonValue,
> = {
  id: string
  kind: Kind
  createdAt: string
  payload: Payload
}
```

This is strict, but it can become annoying when Vercel AI SDK types contain richer structures.

Recommendation:

Use JSON-compatible types for built-in entries and metadata.

For custom entries, document that serialization is only guaranteed if payloads are JSON-compatible.

## 25. Project structure

Suggested initial repository layout:

```txt
baf/
  README.md
  SPEC.md
  package.json
  tsconfig.json
  src/
    index.ts
    session/
      Session.ts
      entries.ts
      serialize.ts
      tokenUsage.ts
    rewriter/
      Rewriter.ts
    routine/
      Routine.ts
    adapters/
      vercel/
        toModelMessages.ts
  examples/
    own-the-loop/
      README.md
      index.ts
  test/
    session.test.ts
    rewrite.test.ts
    tokenUsage.test.ts
    streaming.test.ts
```

If Vite+ conventions suggest a different test/build layout, follow Vite+ where practical.

## 26. Vite+ bootstrap

BAF should be bootstrapped with Vite+.

From the guide, relevant commands are:

```sh
vp create
vp install
vp check
vp test
vp build
```

Since this is a library/package rather than an app, the project should be created as a package if Vite+ supports that interactively.

Core development commands should eventually be:

```sh
vp check
vp test
vp build
```

No implementation should assume a non-browser runtime.

## 27. Testing strategy

BAF should be easy to test because its core is mostly data transformations.

Initial tests should cover:

### Session

- create empty session;
- append single entry;
- append multiple entries;
- preserve ordering;
- preserve immutability;
- serialize and restore;
- support custom entries.

### Token tracking

- record entry-level token usage;
- compute total token usage;
- compute current token payload;
- ensure rewrite output affects current token payload;
- ensure raw historical entries still count toward total payload where appropriate.

### Rewrites

- create rewrite result;
- return derived sessions from rewriters;
- preserve durable session history where required;
- record rewrite metadata;
- define latest-wins behavior if explicit coverage is used.

### Streaming

- create streaming assistant entries;
- update streaming entries immutably;
- finalize streaming entries;
- serialize and restore streaming entries;
- convert finalized streaming entries to model messages.

### Vercel adapter

- convert user entries to model messages;
- convert assistant entries to model messages;
- convert tool call/result entries correctly;
- handle streaming entries appropriately;
- respect explicit rewrite/derived session semantics once finalized.

### Routine shape

- support functional routines;
- return output/context explicitly;
- avoid hidden mutation.

## 28. Documentation style

Documentation should repeatedly emphasize:

- agents are programs;
- the loop is user code;
- BAF gives primitives, not magic;
- rewriters are explicit workflow components;
- sessions are inspectable state;
- token accounting is visible;
- examples are examples.

Possible README opening:

```md
# Boring Agent Framework

Build LLM-powered programs on top of the Vercel AI SDK.

BAF uses the industry word “agent,” but its primitives are sessions, routines,
and rewrites.

It does not own your loop.

It gives you a typed session, explicit workflow entries, context rewriters,
token accounting hooks, streaming-aware message state, and functional routine
shapes so your software can be ordinary TypeScript code.
```

Possible tagline:

```txt
Own the loop.
```

## 29. Open questions

### 29.1 Streaming

What exact representation should streaming assistant messages use?

Initial direction: support both streaming and non-streaming messages, likely with a stream entry that can be updated immutably and finalized.

### 29.2 Tool calls

Tool calls should have their own entries.

Open detail: how closely should these entries mirror Vercel AI SDK stream/tool part shapes?

### 29.3 Direct Vercel AI SDK dependency

Should BAF directly depend on Vercel AI SDK types?

Initial recommendation: yes for `0.0.x`, but avoid over-wrapping the SDK.

### 29.4 Rewrite model

Should rewriters use explicit coverage, return a derived session, return a derived full model context, or support multiple modes?

Current leaning: explore immutable `Session -> Session` or `ModelContext -> ModelContext` rewriters.

### 29.5 Overlapping rewrites

If explicit rewrite coverage exists, latest rewrite wins.

If rewriters return derived sessions, overlapping rewrite behavior may be user-defined composition.

### 29.6 Immutability ergonomics

Should the first version include a mutable adapter/builder?

Initial recommendation: immutable core plus a small `SessionBuilder`/`SessionDraft` convenience.

### 29.7 Token counting implementation

Should BAF include a tokenizer, or only store/report token usage supplied by callers/providers?

Initial recommendation: do not include tokenizer logic initially. Store and aggregate token usage. Add tokenizer adapters later if useful.

### 29.8 Session IDs and entry IDs

Should BAF generate IDs, require user-provided IDs, or both?

Initial recommendation: helper constructors generate IDs, but all constructors accept explicit IDs.

### 29.9 Error representation

Should BAF provide a standard serialized error shape for tool errors and model errors?

Initial recommendation: yes, because sessions should be serializable.

### 29.10 System/developer messages

System/developer messages should be outside the session, but rewriters should be able to rewrite them.

This may require a `ModelContext` abstraction.

### 29.11 Routine abstraction

Should BAF provide only a functional `Routine` type, or also a class-based wrapper for users who prefer classes?

Initial recommendation: start with the functional `Routine` type. Add a thin optional class only if it proves useful.

## 30. MVP scope

The initial `0.0.x` MVP should include:

### Core

- immutable `Session`;
- `SessionBuilder` or equivalent mutable construction helper;
- base `SessionEntry` type;
- built-in entry constructors:
  - `userEntry`;
  - `assistantEntry`;
  - `assistantStreamEntry` or equivalent;
  - `toolCallEntry`;
  - `toolResultEntry`;
  - `rewriteEntry` or rewrite trace entry;
- JSON serialization helpers;
- entry-level token usage;
- session-level token aggregation;
- `Rewriter` interface;
- functional `Routine` type;
- no `AbstractAgent` in the initial MVP unless a concrete need appears;
- Vercel AI SDK adapter for model messages.

### Examples

- `examples/own-the-loop`;
- possibly `examples/compactor` later.

### Tests

- session immutability;
- serialization;
- token aggregation;
- rewrite/derived-session behavior;
- streaming entries;
- model message conversion.

## 31. Design principles

BAF should remain:

- small;
- explicit;
- boring;
- browser-compatible;
- TypeScript-first;
- serializable;
- inspectable;
- testable;
- Vercel AI SDK-friendly;
- streaming-aware;
- unopinionated about loops;
- opinionated about state clarity.

If a feature hides control flow, it probably does not belong in core.

If a feature makes routine state easier to inspect, serialize, test, or measure, it probably does.

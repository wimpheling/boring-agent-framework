# Boring Agent Framework

Build LLM-powered programs on top of the Vercel AI SDK style of APIs.

BAF uses the industry word "agent," but its primitives are sessions, routines,
and rewrites. It does not own your loop.

It gives you a typed session, explicit workflow entries, context rewriters,
token accounting hooks, streaming-aware message state, and functional routine
shapes so your software can stay ordinary TypeScript code.

```ts
import { Session, assistantEntry, toModelMessages, userEntry } from "boring-agent-framework";

let session = Session.empty().append(userEntry("Hello"));

const result = await generateText({
  model,
  messages: toModelMessages(session),
});

session = session.append(
  assistantEntry(result.text, {
    tokenUsage: result.usage,
  }),
);
```

Own the loop.

## Commands

```sh
vp install
vp check
vp test
vp build
```

The core package is browser-compatible and has no runtime dependencies.

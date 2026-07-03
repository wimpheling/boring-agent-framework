import { describe, expect, it } from "vite-plus/test";
import {
  Session,
  appendAssistantStreamChunk,
  assistantStreamEntry,
  completeAssistantStream,
  failAssistantStream,
  toModelMessages,
} from "../src/index.ts";

const createdAt = "2026-01-01T00:00:00.000Z";

describe("assistant stream entries", () => {
  it("creates a streaming assistant entry with an empty chunk history", () => {
    const entry = assistantStreamEntry({}, { id: "stream", createdAt });

    expect(entry).toMatchObject({
      id: "stream",
      kind: "assistant-stream",
      payload: {
        status: "streaming",
        chunks: [],
      },
    });
  });

  it("appends chunks immutably and derives current content from text chunks", () => {
    const entry = assistantStreamEntry({}, { id: "stream", createdAt });

    const first = appendAssistantStreamChunk(entry, { type: "text-delta", text: "Hel" });
    const second = appendAssistantStreamChunk(first, { type: "text-delta", text: "lo" });

    expect(entry.payload.chunks).toHaveLength(0);
    expect(first.payload.content).toBe("Hel");
    expect(second.payload.content).toBe("Hello");
    expect(second.payload.chunks).toEqual([
      { type: "text-delta", text: "Hel" },
      { type: "text-delta", text: "lo" },
    ]);
  });

  it("finalizes streaming entries immutably with token usage", () => {
    const entry = appendAssistantStreamChunk(
      assistantStreamEntry({}, { id: "stream", createdAt }),
      {
        type: "text-delta",
        text: "Hello",
      },
    );

    const complete = completeAssistantStream(entry, { tokenUsage: { output: 3 } });

    expect(entry.payload.status).toBe("streaming");
    expect(complete.payload.status).toBe("complete");
    expect(complete.payload.content).toBe("Hello");
    expect(complete.tokenUsage).toEqual({ output: 3 });
  });

  it("records stream errors in a serializable shape", () => {
    const entry = assistantStreamEntry({}, { id: "stream", createdAt });
    const failed = failAssistantStream(entry, new TypeError("bad stream"));

    expect(failed.payload.status).toBe("error");
    expect(failed.payload.error).toMatchObject({
      name: "TypeError",
      message: "bad stream",
    });
  });

  it("serializes and restores streaming entries", () => {
    const entry = completeAssistantStream(
      appendAssistantStreamChunk(assistantStreamEntry({}, { id: "stream", createdAt }), {
        type: "text-delta",
        text: "Hello",
      }),
    );
    const session = Session.empty({ id: "s" }).append(entry);
    const restored = Session.fromJSON(JSON.parse(JSON.stringify(session.toJSON())));

    expect(restored.entries[0]).toEqual(entry);
  });

  it("converts finalized streams to model messages", () => {
    const entry = completeAssistantStream(
      appendAssistantStreamChunk(assistantStreamEntry({}, { id: "stream", createdAt }), {
        type: "text-delta",
        text: "Hello",
      }),
    );

    expect(toModelMessages(Session.empty({ id: "s" }).append(entry))).toEqual([
      { role: "assistant", content: "Hello" },
    ]);
  });

  it("skips in-progress streams by default and can include current content explicitly", () => {
    const entry = appendAssistantStreamChunk(
      assistantStreamEntry({}, { id: "stream", createdAt }),
      {
        type: "text-delta",
        text: "Hel",
      },
    );
    const session = Session.empty({ id: "s" }).append(entry);

    expect(toModelMessages(session)).toEqual([]);
    expect(toModelMessages(session, { inProgressStreams: "current-content" })).toEqual([
      { role: "assistant", content: "Hel" },
    ]);
  });

  it("can include errored stream content explicitly", () => {
    const entry = failAssistantStream(
      appendAssistantStreamChunk(assistantStreamEntry({}, { id: "stream", createdAt }), {
        type: "text-delta",
        text: "partial",
      }),
      "failed",
    );

    expect(
      toModelMessages(Session.empty({ id: "s" }).append(entry), { includeErroredStreams: true }),
    ).toEqual([{ role: "assistant", content: "partial" }]);
  });
});

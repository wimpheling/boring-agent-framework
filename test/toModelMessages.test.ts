import { describe, expect, it } from "vitest";
import {
  Session,
  assistantEntry,
  rewriteEntry,
  toModelMessages,
  toolCallEntry,
  toolResultEntry,
  userEntry,
} from "../src";

const createdAt = "2026-01-01T00:00:00.000Z";

describe("toModelMessages", () => {
  it("converts user and assistant entries", () => {
    const session = Session.empty({ id: "s" })
      .append(userEntry("Hello", { id: "1", createdAt }))
      .append(assistantEntry("Hi", { id: "2", createdAt }));

    expect(toModelMessages(session)).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
    ]);
  });

  it("prepends system and developer instructions outside the session", () => {
    const session = Session.empty({ id: "s" }).append(userEntry("Hello", { id: "1", createdAt }));

    expect(toModelMessages(session, { system: "system", developer: "developer" })).toEqual([
      { role: "system", content: "system" },
      { role: "developer", content: "developer" },
      { role: "user", content: "Hello" },
    ]);
  });

  it("attaches tool calls to the previous assistant message", () => {
    const session = Session.empty({ id: "s" })
      .append(assistantEntry("I will check", { id: "1", createdAt }))
      .append(
        toolCallEntry(
          { toolCallId: "call-1", toolName: "search", input: { q: "BAF" } },
          { id: "2", createdAt },
        ),
      );

    expect(toModelMessages(session)).toEqual([
      {
        role: "assistant",
        content: "I will check",
        toolCalls: [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "search",
            input: { q: "BAF" },
          },
        ],
      },
    ]);
  });

  it("creates an empty assistant message for orphaned tool calls", () => {
    const session = Session.empty({ id: "s" }).append(
      toolCallEntry(
        { toolCallId: "call-1", toolName: "search", input: "x" },
        { id: "1", createdAt },
      ),
    );

    expect(toModelMessages(session)).toEqual([
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "search",
            input: "x",
          },
        ],
      },
    ]);
  });

  it("groups adjacent tool results into tool messages", () => {
    const session = Session.empty({ id: "s" })
      .append(
        toolResultEntry(
          { toolCallId: "1", toolName: "a", output: { ok: true } },
          { id: "1", createdAt },
        ),
      )
      .append(
        toolResultEntry(
          { toolCallId: "2", toolName: "b", error: { message: "failed" } },
          { id: "2", createdAt },
        ),
      );

    expect(toModelMessages(session)).toEqual([
      {
        role: "tool",
        content: [
          { type: "tool-result", toolCallId: "1", toolName: "a", output: { ok: true } },
          { type: "tool-result", toolCallId: "2", toolName: "b", error: { message: "failed" } },
        ],
      },
    ]);
  });

  it("skips custom entries", () => {
    const session = Session.empty({ id: "s" })
      .append({ id: "custom", kind: "workflow", createdAt, payload: { x: 1 } })
      .append(userEntry("Hello", { id: "1", createdAt }));

    expect(toModelMessages(session)).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("applies rewrite coverage by default and can be disabled", () => {
    const first = userEntry("raw", { id: "1", createdAt });
    const output = Session.empty({ id: "out" }).append(
      assistantEntry("summary", { id: "summary", createdAt }),
    );
    const rewrite = rewriteEntry(
      {
        rewriterName: "summary",
        outputSession: output.toJSON(),
        coverage: { type: "range", fromEntryId: "1", toEntryId: "1" },
      },
      { id: "r1", createdAt },
    );
    const session = Session.empty({ id: "s" }).appendMany([first, rewrite]);

    expect(toModelMessages(session)).toEqual([{ role: "assistant", content: "summary" }]);
    expect(toModelMessages(session, { applyRewriteCoverage: false })).toEqual([
      { role: "user", content: "raw" },
    ]);
  });
});

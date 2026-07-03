import { describe, expect, it } from "vitest";
import {
  Session,
  applyRewriter,
  assistantEntry,
  resolveRewriteEntries,
  rewriteEntry,
  runRewriter,
  toModelMessages,
  userEntry,
  type Rewriter,
} from "../src";

const createdAt = "2026-01-01T00:00:00.000Z";

describe("rewriters", () => {
  it("runs a Session -> Session rewriter", async () => {
    const input = Session.empty({ id: "input" }).append(userEntry("Hello", { id: "1", createdAt }));
    const output = Session.empty({ id: "output" }).append(
      assistantEntry("Summary", { id: "s1", createdAt }),
    );
    const rewriter: Rewriter = {
      name: "summary",
      rewrite: () => output,
    };

    await expect(runRewriter(rewriter, { session: input })).resolves.toMatchObject({
      session: output,
    });
  });

  it("runs a ModelContext -> ModelContext rewriter", async () => {
    const input = Session.empty({ id: "input" });
    const rewriter: Rewriter = {
      name: "system-redactor",
      rewrite: (context) => ({ ...context, system: "redacted" }),
    };

    await expect(
      runRewriter(rewriter, { session: input, system: "secret" }),
    ).resolves.toMatchObject({
      system: "redacted",
      session: input,
    });
  });

  it("records rewrite traces on the durable session", async () => {
    const first = userEntry("Hello", { id: "1", createdAt });
    const input = Session.empty({ id: "input" }).append(first);
    const output = Session.empty({ id: "output" }).append(
      assistantEntry("Summary", { id: "s1", createdAt }),
    );
    const rewriter: Rewriter = {
      name: "summary",
      rewrite: () => output,
    };

    const result = await applyRewriter(
      rewriter,
      { session: input },
      {
        coverage: { type: "range", fromEntryId: "1", toEntryId: "1" },
        metadata: { reason: "budget" },
        tokenUsage: { input: 10, output: 2 },
      },
    );

    expect(result.context.session).toBe(output);
    expect(result.traceEntry.kind).toBe("rewrite");
    expect(result.traceEntry.payload).toMatchObject({
      rewriterName: "summary",
      inputSessionId: "input",
      outputSession: output.toJSON(),
      coverage: { type: "range", fromEntryId: "1", toEntryId: "1" },
    });
    expect(result.traceEntry.metadata).toEqual({ reason: "budget" });
    expect(result.durableSession.entries.map((entry) => entry.kind)).toEqual(["user", "rewrite"]);
  });

  it("records rewrite traces without optional trace metadata", async () => {
    const input = Session.empty({ id: "input" });
    const output = Session.empty({ id: "output" });
    const rewriter: Rewriter = {
      name: "noop",
      rewrite: () => output,
    };

    const result = await applyRewriter(rewriter, { session: input });

    expect(result.traceEntry.payload).toEqual({
      rewriterName: "noop",
      inputSessionId: "input",
      outputSession: output.toJSON(),
    });
    expect(result.traceEntry.tokenUsage).toBeUndefined();
    expect(result.traceEntry.metadata).toBeUndefined();
  });

  it("resolves explicit rewrite coverage into a model-visible session", () => {
    const first = userEntry("first", { id: "1", createdAt });
    const second = assistantEntry("second", { id: "2", createdAt });
    const third = userEntry("third", { id: "3", createdAt });
    const output = Session.empty({ id: "out" }).append(
      assistantEntry("summary", { id: "s1", createdAt }),
    );
    const rewrite = rewriteEntry(
      {
        rewriterName: "summary",
        outputSession: output.toJSON(),
        coverage: { type: "range", fromEntryId: "1", toEntryId: "2" },
      },
      { id: "r1", createdAt },
    );

    const durable = Session.empty({ id: "s" }).appendMany([first, second, third, rewrite]);
    const resolved = resolveRewriteEntries(durable);

    expect(resolved.entries.map((entry) => entry.id)).toEqual(["s1", "3"]);
    expect(toModelMessages(durable)).toEqual([
      { role: "assistant", content: "summary" },
      { role: "user", content: "third" },
    ]);
  });

  it("uses latest rewrite coverage for overlapping entries", () => {
    const one = userEntry("one", { id: "1", createdAt });
    const two = assistantEntry("two", { id: "2", createdAt });
    const three = userEntry("three", { id: "3", createdAt });
    const four = assistantEntry("four", { id: "4", createdAt });
    const earlyOutput = Session.empty({ id: "early" }).append(
      assistantEntry("early", { id: "early-entry", createdAt }),
    );
    const lateOutput = Session.empty({ id: "late" }).append(
      assistantEntry("late", { id: "late-entry", createdAt }),
    );
    const early = rewriteEntry(
      {
        rewriterName: "early",
        outputSession: earlyOutput.toJSON(),
        coverage: { type: "range", fromEntryId: "1", toEntryId: "3" },
      },
      { id: "r1", createdAt },
    );
    const late = rewriteEntry(
      {
        rewriterName: "late",
        outputSession: lateOutput.toJSON(),
        coverage: { type: "range", fromEntryId: "2", toEntryId: "4" },
      },
      { id: "r2", createdAt },
    );

    const resolved = resolveRewriteEntries(
      Session.empty({ id: "s" }).appendMany([one, two, three, four, early, late]),
    );

    expect(resolved.entries.map((entry) => entry.id)).toEqual(["early-entry", "late-entry"]);
  });

  it("throws for missing, reversed, or self-covering rewrite ranges", () => {
    const first = userEntry("first", { id: "1", createdAt });
    const output = Session.empty({ id: "out" }).append(
      assistantEntry("summary", { id: "s1", createdAt }),
    );

    const missing = rewriteEntry(
      {
        rewriterName: "bad",
        outputSession: output.toJSON(),
        coverage: { type: "range", fromEntryId: "missing", toEntryId: "1" },
      },
      { id: "r1", createdAt },
    );
    const reversed = rewriteEntry(
      {
        rewriterName: "bad",
        outputSession: output.toJSON(),
        coverage: { type: "range", fromEntryId: "2", toEntryId: "1" },
      },
      { id: "r2", createdAt },
    );
    const second = assistantEntry("second", { id: "2", createdAt });
    const selfCovering = rewriteEntry(
      {
        rewriterName: "bad",
        outputSession: output.toJSON(),
        coverage: { type: "range", fromEntryId: "1", toEntryId: "r3" },
      },
      { id: "r3", createdAt },
    );

    expect(() =>
      resolveRewriteEntries(Session.empty({ id: "s" }).appendMany([first, missing])),
    ).toThrow("references missing");
    expect(() =>
      resolveRewriteEntries(Session.empty({ id: "s" }).appendMany([first, second, reversed])),
    ).toThrow("reversed");
    expect(() =>
      resolveRewriteEntries(Session.empty({ id: "s" }).appendMany([first, selfCovering])),
    ).toThrow("cannot include");
  });
});

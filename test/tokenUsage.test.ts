import { describe, expect, it } from "vitest";
import { Session, addTokenUsage, assistantEntry, rewriteEntry, userEntry } from "../src";

const createdAt = "2026-01-01T00:00:00.000Z";

describe("token usage", () => {
  it("normalizes total usage from input and output when total is omitted", () => {
    expect(addTokenUsage({ input: 2, output: 3 })).toEqual({
      input: 2,
      output: 3,
      total: 5,
    });
  });

  it("aggregates entry-level token usage", () => {
    const session = Session.empty({ id: "s" })
      .append(
        userEntry("Hello", { id: "1", createdAt, tokenUsage: { input: 4, source: "estimated" } }),
      )
      .append(
        assistantEntry("Hi", {
          id: "2",
          createdAt,
          tokenUsage: { output: 6, source: "estimated" },
        }),
      );

    expect(session.getTokenSummary()).toEqual({
      current: { input: 4, output: 6, total: 10, source: "estimated" },
      total: { input: 4, output: 6, total: 10, source: "estimated" },
    });
  });

  it("marks source as mixed when token usage sources differ", () => {
    expect(
      addTokenUsage(
        { input: 1, source: "estimated", model: "a" },
        { output: 2, source: "provider-reported", model: "a" },
      ),
    ).toEqual({
      input: 1,
      output: 2,
      total: 3,
      source: "mixed",
      model: "a",
    });
  });

  it("includes session-level usage in total but not current", () => {
    const session = new Session({
      id: "s",
      tokenUsage: { input: 100, source: "provider-reported" },
      entries: [assistantEntry("Hi", { id: "1", createdAt, tokenUsage: { output: 5 } })],
    });

    expect(session.getTokenSummary()).toEqual({
      current: { output: 5, total: 5 },
      total: { input: 100, output: 5, total: 105, source: "mixed" },
    });
  });

  it("uses rewrite output for current payload while preserving raw history in total", () => {
    const first = userEntry("Long user text", { id: "1", createdAt, tokenUsage: { input: 100 } });
    const second = assistantEntry("Long answer", {
      id: "2",
      createdAt,
      tokenUsage: { output: 150 },
    });
    const compacted = Session.empty({ id: "compact" }).append(
      assistantEntry("Summary", { id: "c1", createdAt, tokenUsage: { input: 12 } }),
    );
    const rewrite = rewriteEntry(
      {
        rewriterName: "compact",
        inputSessionId: "s",
        outputSession: compacted.toJSON(),
        coverage: { type: "range", fromEntryId: "1", toEntryId: "2" },
      },
      { id: "r1", createdAt, tokenUsage: { input: 250, output: 12 } },
    );

    const session = Session.empty({ id: "s" }).appendMany([first, second, rewrite]);

    expect(session.getTokenSummary()).toEqual({
      current: { input: 12, total: 12 },
      total: { input: 350, output: 162, total: 512 },
    });
  });

  it("returns empty token summaries for sessions without usage", () => {
    const session = Session.empty({ id: "s" }).append(userEntry("Hello", { id: "1", createdAt }));

    expect(session.getTokenSummary()).toEqual({
      current: {},
      total: {},
    });
  });
});

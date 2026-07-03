import { describe, expect, it } from "vitest";
import {
  Session,
  SessionBuilder,
  assistantEntry,
  createEntry,
  userEntry,
  type SessionEntry,
} from "../src";

const fixed = {
  id: "entry",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("Session", () => {
  it("creates an empty serializable session", () => {
    const session = Session.empty({ id: "session-1", metadata: { traceId: "trace" } });

    expect(session.id).toBe("session-1");
    expect(session.entries).toEqual([]);
    expect(session.toJSON()).toEqual({
      version: "0.0",
      id: "session-1",
      entries: [],
      metadata: { traceId: "trace" },
    });
  });

  it("appends one entry without mutating the original session", () => {
    const session = Session.empty({ id: "session-1" });
    const entry = userEntry("Hello", fixed);

    const next = session.append(entry);

    expect(session.entries).toHaveLength(0);
    expect(next.entries).toHaveLength(1);
    expect(next.entries[0]).toEqual(entry);
    expect(next.id).toBe(session.id);
  });

  it("appends many entries and preserves ordering", () => {
    const first = userEntry("Hello", { id: "1", createdAt: fixed.createdAt });
    const second = assistantEntry("Hi", { id: "2", createdAt: fixed.createdAt });

    const session = Session.empty({ id: "s" }).appendMany([first, second]);

    expect(session.entries.map((entry) => entry.id)).toEqual(["1", "2"]);
  });

  it("replaces and removes entries immutably", () => {
    const first = userEntry("Hello", { id: "1", createdAt: fixed.createdAt });
    const second = assistantEntry("Hi", { id: "2", createdAt: fixed.createdAt });
    const session = Session.empty({ id: "s" }).appendMany([first, second]);

    const replaced = session.replaceEntry(
      "2",
      assistantEntry("Changed", { id: "2b", createdAt: fixed.createdAt }),
    );
    const removed = replaced.removeEntry("1");

    expect(session.entries.map((entry) => entry.id)).toEqual(["1", "2"]);
    expect(replaced.entries.map((entry) => entry.id)).toEqual(["1", "2b"]);
    expect(removed.entries.map((entry) => entry.id)).toEqual(["2b"]);
  });

  it("updates an entry immutably", () => {
    const session = Session.empty({ id: "s" }).append(
      userEntry("Hello", { id: "1", createdAt: fixed.createdAt }),
    );

    const updated = session.updateEntry("1", () =>
      assistantEntry("Hi", { id: "2", createdAt: fixed.createdAt }),
    );

    expect(session.entries[0]?.kind).toBe("user");
    expect(updated.entries[0]?.kind).toBe("assistant");
  });

  it("throws when replacing, updating, or removing missing entries", () => {
    const session = Session.empty({ id: "s" });

    expect(() => session.replaceEntry("missing", userEntry("x"))).toThrow("Cannot replace missing");
    expect(() => session.updateEntry("missing", (entry) => entry)).toThrow("Cannot update missing");
    expect(() => session.removeEntry("missing")).toThrow("Cannot remove missing");
  });

  it("supports a local mutable builder without making Session mutable", () => {
    const session = Session.empty({ id: "s" }).append(
      userEntry("Hello", { id: "1", createdAt: fixed.createdAt }),
    );

    const next = session.build((draft) => {
      draft.append(assistantEntry("Hi", { id: "2", createdAt: fixed.createdAt }));
      draft.replaceEntry("1", userEntry("Changed", { id: "1", createdAt: fixed.createdAt }));
    });

    expect(session.entries).toHaveLength(1);
    expect(session.entries[0]?.payload).toEqual({ content: "Hello" });
    expect(next.entries.map((entry) => entry.payload)).toEqual([
      { content: "Changed" },
      { content: "Hi" },
    ]);
  });

  it("exposes SessionBuilder for explicit draft construction", () => {
    const session = Session.empty({ id: "s" });
    const next = SessionBuilder.from(session).append(userEntry("Hello", fixed)).build();

    expect(session.entries).toHaveLength(0);
    expect(next.entries).toHaveLength(1);
  });

  it("supports all SessionBuilder mutation helpers", () => {
    const session = Session.empty({
      id: "s",
      tokenUsage: { total: 1 },
      metadata: { traceId: "trace" },
    });
    const next = SessionBuilder.from(session)
      .appendMany([
        userEntry("Hello", { id: "1", createdAt: fixed.createdAt }),
        assistantEntry("Hi", { id: "2", createdAt: fixed.createdAt }),
      ])
      .updateEntry("2", () => assistantEntry("Changed", { id: "2", createdAt: fixed.createdAt }))
      .removeEntry("1")
      .build();

    expect(next.id).toBe("s");
    expect(next.tokenUsage).toEqual({ total: 1 });
    expect(next.metadata).toEqual({ traceId: "trace" });
    expect(next.entries.map((entry) => entry.payload)).toEqual([{ content: "Changed" }]);
  });

  it("throws from SessionBuilder helpers for missing entries", () => {
    const builder = SessionBuilder.from(Session.empty({ id: "s" }));

    expect(() => builder.replaceEntry("missing", userEntry("x"))).toThrow("Cannot replace missing");
    expect(() => builder.updateEntry("missing", (entry) => entry)).toThrow("Cannot update missing");
    expect(() => builder.removeEntry("missing")).toThrow("Cannot remove missing");
  });

  it("round-trips through JSON without losing framework meaning", () => {
    const session = Session.empty({ id: "s" })
      .append(
        userEntry("Hello", { id: "1", createdAt: fixed.createdAt, metadata: { role: "test" } }),
      )
      .append(
        assistantEntry("Hi", { id: "2", createdAt: fixed.createdAt, tokenUsage: { output: 2 } }),
      );

    const restored = Session.fromJSON(JSON.parse(JSON.stringify(session.toJSON())));

    expect(restored).toBeInstanceOf(Session);
    expect(restored.toJSON()).toEqual(session.toJSON());
    expect(restored.entries[1]?.tokenUsage).toEqual({ output: 2 });
  });

  it("rejects unsupported serialized session versions", () => {
    expect(() =>
      Session.fromJSON({
        version: "1.0" as "0.0",
        id: "s",
        entries: [],
      }),
    ).toThrow("Unsupported session version");
  });

  it("supports custom entries", () => {
    const custom = createEntry("workflow", { name: "started" }, fixed);
    const session = Session.empty({ id: "s" }).append(custom);

    expect(session.entries[0]).toMatchObject<Partial<SessionEntry>>({
      id: "entry",
      kind: "workflow",
      payload: { name: "started" },
    });
  });

  it("accepts Date timestamps and custom id generators in entry constructors", () => {
    const entry = createEntry(
      "workflow",
      { name: "started" },
      {
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        idGenerator: () => "generated",
      },
    );

    expect(entry.id).toBe("generated");
    expect(entry.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("defensively clones appended entries and freezes session state", () => {
    const mutable = userEntry("Hello", { id: "1", createdAt: fixed.createdAt });
    const session = Session.empty({ id: "s" }).append(mutable);

    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.isFrozen(session.entries)).toBe(true);
    expect(Object.isFrozen(session.entries[0])).toBe(true);
    expect(() => ((session.entries as SessionEntry[])[0] = userEntry("nope"))).toThrow();
  });
});

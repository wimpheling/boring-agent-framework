import { describe, expect, it } from "vitest";
import { Session, assistantEntry, userEntry, type Routine } from "../src";

const createdAt = "2026-01-01T00:00:00.000Z";

describe("Routine", () => {
  it("supports functional routines that return output and next context explicitly", async () => {
    const routine: Routine<string, string> = (input, context) => {
      const session = context.session
        .append(userEntry(input, { id: "user", createdAt }))
        .append(assistantEntry("answer", { id: "assistant", createdAt }));

      return {
        output: "answer",
        context: {
          ...context,
          session,
        },
      };
    };

    const initial = { session: Session.empty({ id: "s" }) };
    const result = await routine("question", initial);

    expect(initial.session.entries).toHaveLength(0);
    expect(result.output).toBe("answer");
    expect(result.context.session.entries.map((entry) => entry.kind)).toEqual([
      "user",
      "assistant",
    ]);
  });

  it("preserves routine metadata and instructions by user code", async () => {
    const routine: Routine<string, string> = (input, context) => ({
      output: input.toUpperCase(),
      context,
    });

    const context = {
      session: Session.empty({ id: "s" }),
      instructions: { system: "be direct" },
      metadata: { traceId: "trace" },
    };

    await expect(Promise.resolve(routine("ok", context))).resolves.toEqual({
      output: "OK",
      context,
    });
  });
});

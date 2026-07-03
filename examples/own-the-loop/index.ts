import {
  Session,
  assistantEntry,
  toModelMessages,
  toolCallEntry,
  toolResultEntry,
  userEntry,
  type ModelMessage,
} from "../../src";

type GenerateTextResult = {
  readonly text: string;
  readonly usage?: { readonly input?: number; readonly output?: number; readonly total?: number };
  readonly toolCalls: readonly {
    readonly toolCallId: string;
    readonly toolName: string;
    readonly input: unknown;
  }[];
};

type GenerateText = (input: {
  readonly messages: readonly ModelMessage[];
}) => Promise<GenerateTextResult>;
type ExecuteTool = (toolCall: GenerateTextResult["toolCalls"][number]) => Promise<unknown>;

export async function runOwnLoop(
  prompt: string,
  generateText: GenerateText,
  executeTool: ExecuteTool,
  maxSteps = 4,
): Promise<Session> {
  let session = Session.empty().append(userEntry(prompt));

  for (let step = 0; step < maxSteps; step += 1) {
    const result = await generateText({
      messages: toModelMessages(session),
    });

    session = session.append(assistantEntry(result.text, { tokenUsage: result.usage }));

    if (result.toolCalls.length === 0) {
      break;
    }

    for (const toolCall of result.toolCalls) {
      session = session.append(toolCallEntry(toolCall));
      const output = await executeTool(toolCall);
      session = session.append(
        toolResultEntry({
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          output,
        }),
      );
    }
  }

  return session;
}

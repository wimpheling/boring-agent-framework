import type { JsonObject, MaybePromise } from "../types";
import { rewriteEntry, type RewriteCoverage, type RewriteEntry } from "../session/entries";
import { Session } from "../session/Session";
import type { TokenUsage } from "../session/tokenUsage";

export type ModelContext<TSession extends Session = Session> = {
  readonly session: TSession;
  readonly system?: string;
  readonly developer?: string;
  readonly metadata?: JsonObject;
};

export type RewriteInput<TSession extends Session = Session> = ModelContext<TSession>;

export type RewriteOutput<TSession extends Session = Session> = ModelContext<TSession> | TSession;

export interface Rewriter<
  TInput extends RewriteInput = RewriteInput,
  TOutput extends RewriteOutput = RewriteOutput,
> {
  readonly name: string;
  rewrite(input: TInput): MaybePromise<TOutput>;
}

export type RewriteTraceOptions = {
  readonly coverage?: RewriteCoverage;
  readonly tokenUsage?: TokenUsage;
  readonly metadata?: JsonObject;
};

export type ApplyRewriterResult = {
  readonly context: ModelContext;
  readonly traceEntry: RewriteEntry;
  readonly durableSession: Session;
};

export async function runRewriter<TInput extends RewriteInput>(
  rewriter: Rewriter<TInput>,
  input: TInput,
): Promise<ModelContext> {
  const output = await rewriter.rewrite(input);

  if (output instanceof Session) {
    return { ...input, session: output };
  }

  return output;
}

export async function applyRewriter<TInput extends RewriteInput>(
  rewriter: Rewriter<TInput>,
  input: TInput,
  options: RewriteTraceOptions = {},
): Promise<ApplyRewriterResult> {
  const context = await runRewriter(rewriter, input);
  const traceEntry = rewriteEntry(
    {
      rewriterName: rewriter.name,
      inputSessionId: input.session.id,
      outputSession: context.session.toJSON(),
      ...(options.coverage ? { coverage: options.coverage } : {}),
    },
    {
      ...(options.tokenUsage ? { tokenUsage: options.tokenUsage } : {}),
      ...(options.metadata ? { metadata: options.metadata } : {}),
    },
  );

  return {
    context,
    traceEntry,
    durableSession: input.session.append(traceEntry),
  };
}

import type { JsonObject, MaybePromise } from "../types.js";
import type { Session } from "../session/Session.js";

export type Instructions = {
  readonly system?: string;
  readonly developer?: string;
};

export type RoutineContext<TSession extends Session = Session> = {
  readonly session: TSession;
  readonly instructions?: Instructions;
  readonly metadata?: JsonObject;
};

export type RoutineRunResult<TOutput, TContext extends RoutineContext = RoutineContext> = {
  readonly output: TOutput;
  readonly context: TContext;
};

export type Routine<
  TInput = unknown,
  TOutput = unknown,
  TContext extends RoutineContext = RoutineContext,
> = (input: TInput, context: TContext) => MaybePromise<RoutineRunResult<TOutput, TContext>>;

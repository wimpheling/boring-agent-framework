export type JsonPrimitive = null | boolean | number | string;

export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

export type JsonObject = { readonly [key: string]: JsonValue };

export type MaybePromise<T> = T | Promise<T>;

export type SerializedError = {
  readonly name?: string;
  readonly message: string;
  readonly stack?: string;
  readonly cause?: unknown;
  readonly metadata?: JsonObject;
};

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack === undefined ? {} : { stack: error.stack }),
      ...(error.cause === undefined ? {} : { cause: error.cause }),
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  return {
    message: "Unknown error",
    cause: error,
  };
}

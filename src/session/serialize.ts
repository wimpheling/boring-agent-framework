import type { JsonObject } from "../types";
import type { SessionEntry } from "./entries";
import type { TokenUsage } from "./tokenUsage";

export type SessionVersion = "0.0";

export type SerializedSession = {
  readonly version: SessionVersion;
  readonly id: string;
  readonly entries: readonly SessionEntry[];
  readonly tokenUsage?: TokenUsage;
  readonly metadata?: JsonObject;
};

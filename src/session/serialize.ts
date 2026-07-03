import type { JsonObject } from "../types.js";
import type { SessionEntry } from "./entries.js";
import type { TokenUsage } from "./tokenUsage.js";

export type SessionVersion = "0.0";

export type SerializedSession = {
  readonly version: SessionVersion;
  readonly id: string;
  readonly entries: readonly SessionEntry[];
  readonly tokenUsage?: TokenUsage;
  readonly metadata?: JsonObject;
};

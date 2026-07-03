import type { JsonObject } from "../types.js";
import { cloneValue, deepFreeze } from "../utils/clone.js";
import { defaultIdGenerator, type IdGenerator } from "../utils/id.js";
import { isRewriteEntry, type SessionEntry } from "./entries.js";
import type { SerializedSession } from "./serialize.js";
import {
  addTokenUsage,
  sumEntryTokenUsage,
  type SessionTokenSummary,
  type TokenUsage,
} from "./tokenUsage.js";

export type SessionOptions = {
  readonly id?: string;
  readonly entries?: readonly SessionEntry[];
  readonly tokenUsage?: TokenUsage;
  readonly metadata?: JsonObject;
  readonly idGenerator?: IdGenerator;
};

export type BuildSession = (draft: SessionBuilder) => void;

export class Session {
  readonly version = "0.0" as const;
  readonly id: string;
  readonly entries: readonly SessionEntry[];
  readonly tokenUsage?: TokenUsage;
  readonly metadata?: JsonObject;

  constructor(options: SessionOptions = {}) {
    this.id = options.id ?? (options.idGenerator ?? defaultIdGenerator)();
    this.entries = deepFreeze((options.entries ?? []).map((entry) => cloneValue(entry)));

    if (options.tokenUsage) {
      this.tokenUsage = deepFreeze(cloneValue(options.tokenUsage));
    }

    if (options.metadata) {
      this.metadata = deepFreeze(cloneValue(options.metadata));
    }

    deepFreeze(this);
  }

  static empty(options: Omit<SessionOptions, "entries"> = {}): Session {
    return new Session({ ...options, entries: [] });
  }

  static fromJSON(value: SerializedSession): Session {
    if (value.version !== "0.0") {
      throw new Error(`Unsupported session version: ${String(value.version)}`);
    }

    return new Session(value);
  }

  append(entry: SessionEntry): Session {
    return this.withEntries([...this.entries, entry]);
  }

  appendMany(entries: readonly SessionEntry[]): Session {
    return this.withEntries([...this.entries, ...entries]);
  }

  replaceEntry(id: string, entry: SessionEntry): Session {
    let replaced = false;
    const entries = this.entries.map((existing) => {
      if (existing.id === id) {
        replaced = true;
        return entry;
      }

      return existing;
    });

    if (!replaced) {
      throw new Error(`Cannot replace missing session entry: ${id}`);
    }

    return this.withEntries(entries);
  }

  updateEntry(id: string, updater: (entry: SessionEntry) => SessionEntry): Session {
    const entry = this.getEntry(id);

    if (!entry) {
      throw new Error(`Cannot update missing session entry: ${id}`);
    }

    return this.replaceEntry(id, updater(entry));
  }

  removeEntry(id: string): Session {
    const entries = this.entries.filter((entry) => entry.id !== id);

    if (entries.length === this.entries.length) {
      throw new Error(`Cannot remove missing session entry: ${id}`);
    }

    return this.withEntries(entries);
  }

  build(callback: BuildSession): Session {
    const builder = SessionBuilder.from(this);
    callback(builder);
    return builder.build();
  }

  getEntry<TEntry extends SessionEntry = SessionEntry>(id: string): TEntry | undefined {
    return this.entries.find((entry) => entry.id === id) as TEntry | undefined;
  }

  getTokenSummary(): SessionTokenSummary {
    const currentEntries = resolveRewriteEntries(this).entries;

    return {
      current: sumEntryTokenUsage(currentEntries),
      total: addTokenUsage(this.tokenUsage, sumEntryTokenUsage(this.entries)),
    };
  }

  toJSON(): SerializedSession {
    return {
      version: this.version,
      id: this.id,
      entries: cloneValue(this.entries),
      ...(this.tokenUsage ? { tokenUsage: cloneValue(this.tokenUsage) } : {}),
      ...(this.metadata ? { metadata: cloneValue(this.metadata) } : {}),
    };
  }

  private withEntries(entries: readonly SessionEntry[]): Session {
    return new Session({
      id: this.id,
      entries,
      ...(this.tokenUsage ? { tokenUsage: this.tokenUsage } : {}),
      ...(this.metadata ? { metadata: this.metadata } : {}),
    });
  }
}

export class SessionBuilder {
  private readonly source: Session;
  private entries: SessionEntry[];

  private constructor(session: Session) {
    this.source = session;
    this.entries = [...session.entries];
  }

  static from(session: Session): SessionBuilder {
    return new SessionBuilder(session);
  }

  append(entry: SessionEntry): this {
    this.entries.push(entry);
    return this;
  }

  appendMany(entries: readonly SessionEntry[]): this {
    this.entries.push(...entries);
    return this;
  }

  replaceEntry(id: string, entry: SessionEntry): this {
    const index = this.entries.findIndex((existing) => existing.id === id);

    if (index === -1) {
      throw new Error(`Cannot replace missing session entry: ${id}`);
    }

    this.entries[index] = entry;
    return this;
  }

  updateEntry(id: string, updater: (entry: SessionEntry) => SessionEntry): this {
    const entry = this.entries.find((existing) => existing.id === id);

    if (!entry) {
      throw new Error(`Cannot update missing session entry: ${id}`);
    }

    return this.replaceEntry(id, updater(entry));
  }

  removeEntry(id: string): this {
    const length = this.entries.length;
    this.entries = this.entries.filter((entry) => entry.id !== id);

    if (this.entries.length === length) {
      throw new Error(`Cannot remove missing session entry: ${id}`);
    }

    return this;
  }

  build(): Session {
    return new Session({
      id: this.source.id,
      entries: this.entries,
      ...(this.source.tokenUsage ? { tokenUsage: this.source.tokenUsage } : {}),
      ...(this.source.metadata ? { metadata: this.source.metadata } : {}),
    });
  }
}

export function resolveRewriteEntries(session: Session): Session {
  const ownerByEntryIndex = new Map<number, string>();
  const replacements = new Map<string, readonly SessionEntry[]>();
  const entries = session.entries;

  for (const [rewriteIndex, entry] of entries.entries()) {
    if (!isRewriteEntry(entry) || !entry.payload.coverage) {
      continue;
    }

    const fromIndex = entries.findIndex(
      (candidate) => candidate.id === entry.payload.coverage?.fromEntryId,
    );
    const toIndex = entries.findIndex(
      (candidate) => candidate.id === entry.payload.coverage?.toEntryId,
    );

    if (fromIndex === -1 || toIndex === -1) {
      throw new Error(`Rewrite coverage references missing entry in rewrite: ${entry.id}`);
    }

    if (fromIndex > toIndex) {
      throw new Error(`Rewrite coverage range is reversed in rewrite: ${entry.id}`);
    }

    if (toIndex >= rewriteIndex) {
      throw new Error(`Rewrite coverage cannot include the rewrite entry itself: ${entry.id}`);
    }

    replacements.set(entry.id, Session.fromJSON(entry.payload.outputSession).entries);

    for (let index = fromIndex; index <= toIndex; index += 1) {
      ownerByEntryIndex.set(index, entry.id);
    }
  }

  if (ownerByEntryIndex.size === 0) {
    return session;
  }

  const resolved: SessionEntry[] = [];
  let previousOwner: string | undefined;

  for (const [index, entry] of entries.entries()) {
    const owner = ownerByEntryIndex.get(index);

    if (owner) {
      if (owner !== previousOwner) {
        resolved.push(...(replacements.get(owner) ?? []));
      }

      previousOwner = owner;
      continue;
    }

    previousOwner = undefined;

    if (!isRewriteEntry(entry)) {
      resolved.push(entry);
    }
  }

  return new Session({
    id: session.id,
    entries: resolved,
    ...(session.metadata ? { metadata: session.metadata } : {}),
  });
}

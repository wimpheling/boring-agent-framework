import type { JsonObject } from "../types";
import type { SessionEntry } from "./entries";

export type TokenUsage = {
  readonly input?: number;
  readonly output?: number;
  readonly total?: number;
  readonly source?: "exact" | "estimated" | "provider-reported" | "mixed" | string;
  readonly model?: string;
  readonly metadata?: JsonObject;
};

export type SessionTokenSummary = {
  readonly current: TokenUsage;
  readonly total: TokenUsage;
};

export function normalizeTokenUsage(usage?: TokenUsage): TokenUsage {
  if (!usage) {
    return {};
  }

  const total = usage.total ?? sumDefined(usage.input, usage.output);

  return {
    ...usage,
    ...(total === undefined ? {} : { total }),
  };
}

export function addTokenUsage(...usages: readonly (TokenUsage | undefined)[]): TokenUsage {
  const normalized = usages.map(normalizeTokenUsage).filter(hasTokenNumbers);

  if (normalized.length === 0) {
    return {};
  }

  const input = sumField(normalized, "input");
  const output = sumField(normalized, "output");
  const total = sumField(normalized, "total") ?? sumDefined(input, output);
  const source = mergeSource(normalized);
  const model = sameField(normalized, "model");

  return {
    ...(input === undefined ? {} : { input }),
    ...(output === undefined ? {} : { output }),
    ...(total === undefined ? {} : { total }),
    ...(source === undefined ? {} : { source }),
    ...(model === undefined ? {} : { model }),
  };
}

export function sumEntryTokenUsage(entries: readonly SessionEntry[]): TokenUsage {
  return addTokenUsage(...entries.map((entry) => entry.tokenUsage));
}

function hasTokenNumbers(usage: TokenUsage): boolean {
  return usage.input !== undefined || usage.output !== undefined || usage.total !== undefined;
}

function sumField(
  usages: readonly TokenUsage[],
  field: "input" | "output" | "total",
): number | undefined {
  let total = 0;
  let found = false;

  for (const usage of usages) {
    const value = usage[field];
    if (value !== undefined) {
      total += value;
      found = true;
    }
  }

  return found ? total : undefined;
}

function sameField<TField extends "source" | "model">(
  usages: readonly TokenUsage[],
  field: TField,
): TokenUsage[TField] | undefined {
  const values = usages.map((usage) => usage[field]).filter((value) => value !== undefined);

  if (values.length === 0) {
    return undefined;
  }

  const [first] = values;
  return values.every((value) => value === first) ? first : undefined;
}

function mergeSource(usages: readonly TokenUsage[]): TokenUsage["source"] | undefined {
  const sources = usages.map((usage) => usage.source);
  const definedSources = sources.filter((source) => source !== undefined);

  if (definedSources.length === 0) {
    return undefined;
  }

  const [first] = definedSources;
  const allHaveSource = definedSources.length === usages.length;
  const allSame = definedSources.every((source) => source === first);

  return allHaveSource && allSame ? first : "mixed";
}

function sumDefined(...values: readonly (number | undefined)[]): number | undefined {
  let total = 0;
  let found = false;

  for (const value of values) {
    if (value !== undefined) {
      total += value;
      found = true;
    }
  }

  return found ? total : undefined;
}

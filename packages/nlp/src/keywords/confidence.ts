import type { TermPenalty, TermSignals } from "@concordance-wiki/core";

/**
 * What the confidence of a candidate is read from: five measures of the corpus alone, no
 * learning; `spread` is `df / N`, `burst` is `occurrences / df`, `prominence` the appearances
 * in a heading, a written link or the frontmatter per occurrence, capped at one.
 */
export type ConfidenceSignals = TermSignals;

/** The signals with the counts that decide whether the spread and the burst read: the files of the corpus and of the expression. */
export interface ConfidenceInput extends ConfidenceSignals {
  /** Files of the corpus. */
  corpus: number;
  /** Distinct files holding the expression. */
  files: number;
}

export interface ConfidenceOptions {
  /** Share of the files beyond which the expression belongs to the language rather than the subject. */
  maxSpread: number;
}

/** The five factors of the product, each in [0, 1], in the order of the formula. */
export interface ConfidenceFactors {
  spread: number;
  burst: number;
  position: number;
  neighbourhood: number;
  morphology: number;
}

/** A signal that lowered the confidence: what the to-do page words as the reason. */
export type ConfidencePenalty = TermPenalty;

export const confidenceDefaults: ConfidenceOptions = { maxSpread: 0.5 };

/** Files a corpus must hold before the spread of an expression is read: in a handful, every word is everywhere. */
export const SPREAD_MIN_FILES = 10;
/** Files an expression must reach before its occurrences per file are read. */
export const BURST_MIN_FILES = 5;
/** Occurrences per file from which an expression recurs where it is treated. */
export const BURST_PER_FILE = 1.5;
/** The position factor of an expression never put forward; the bonus fills the rest. */
export const POSITION_BASE = 0.8;
/** The neighbourhood factor of an expression no defined term accompanies. */
export const NEIGHBOURHOOD_BASE = 0.9;
/** The morphology factor of an inflected form: a soft penalty, never an elimination. */
export const MORPHOLOGY_PENALTY = 0.8;

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * The factors of the formula: spread falls linearly from 1 at `maxSpread` to 0 when the
 * expression is in every file, and reads only in a corpus of `SPREAD_MIN_FILES` files; burst
 * rises linearly from 0.5 at one occurrence per file to 1 at `BURST_PER_FILE`, and reads
 * only from `BURST_MIN_FILES` files; position is
 * `POSITION_BASE` plus the prominence share of the rest; neighbourhood is 1 with the bonus,
 * `NEIGHBOURHOOD_BASE` without; morphology is `MORPHOLOGY_PENALTY` for an inflected form, 1
 * otherwise.
 */
export function confidenceFactors(
  input: ConfidenceInput,
  options: ConfidenceOptions = confidenceDefaults,
): ConfidenceFactors {
  const excess =
    input.corpus < SPREAD_MIN_FILES
      ? 0
      : Math.max(0, input.spread - options.maxSpread) / (1 - options.maxSpread);
  // Below `BURST_MIN_FILES` files, once per file says nothing; an expression never occurs less than once per file.
  const burst =
    input.files < BURST_MIN_FILES
      ? 1
      : Math.min(1, 0.5 + (0.5 * (input.burst - 1)) / (BURST_PER_FILE - 1));
  return {
    spread: 1 - excess,
    burst,
    position: POSITION_BASE + (1 - POSITION_BASE) * input.prominence,
    neighbourhood: input.neighbour ? 1 : NEIGHBOURHOOD_BASE,
    morphology: input.inflected ? MORPHOLOGY_PENALTY : 1,
  };
}

/** The product of the five factors, rounded to four decimals. */
export function confidenceOf(
  input: ConfidenceInput,
  options: ConfidenceOptions = confidenceDefaults,
): number {
  const factors = confidenceFactors(input, options);
  return round(
    factors.spread * factors.burst * factors.position * factors.neighbourhood * factors.morphology,
  );
}

/** The signals that lowered the confidence, in the order of the formula; the bonuses never count. */
export function confidencePenalties(
  input: ConfidenceInput,
  options: ConfidenceOptions = confidenceDefaults,
): ConfidencePenalty[] {
  const factors = confidenceFactors(input, options);
  const penalties: ConfidencePenalty[] = [];
  if (factors.spread < 1) penalties.push("spread");
  if (factors.burst < 1) penalties.push("burst");
  if (factors.morphology < 1) penalties.push("morphology");
  return penalties;
}

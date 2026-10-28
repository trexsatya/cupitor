// Pure selection and state bookkeeping for the automatic F1 collector.
// The state file lives alongside the data repo, not in volatile Actions artifacts.
export function validPositive(value, label, allowZero = false) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < (allowZero ? 0 : 1)) {
    throw new Error(label + ' must be ' + (allowZero ? 'a non-negative' : 'a positive') + ' whole number');
  }
  return n;
}

export function parseAutoState(data) {
  if (!data) return { version: 1, attempts: {}, totals: { batches: 0, spentCredits: 0, savedCaptures: 0 } };
  if (data.version !== 1 || !data.attempts || typeof data.attempts !== 'object' ||
      !data.totals || !Number.isFinite(data.totals.spentCredits)) {
    throw new Error('Invalid f1 auto-collection state. Do not discard it silently.');
  }
  return data;
}

export function chooseAutoBatch(pending, state, { batchSize, maxNoYield }) {
  return pending.filter(entry => (state.attempts[entry.line]?.noYieldStreak || 0) < maxNoYield)
    .slice(0, batchSize);
}

export function updateAutoState(state, results, { maxNoYield }) {
  for (const result of results) {
    if (!result || !result.word) continue;
    const previous = state.attempts[result.word] || { noYieldStreak: 0, runs: 0 };
    // Don't penalize words for quota exhaustion, global run limits, or transient
    // API errors: those are operational failures, not bad search terms.
    if (result.budgetExhausted || result.error) {
      state.attempts[result.word] = previous;
      continue;
    }
    const gain = Number(result.count ?? result.before ?? 0) - Number(result.before ?? result.count ?? 0);
    const streak = gain > 0 || result.remaining === 0 ? 0 : previous.noYieldStreak + 1;
    state.attempts[result.word] = {
      noYieldStreak: streak, runs: previous.runs + 1,
      lastCount: result.count ?? previous.lastCount ?? null,
      lastRemaining: result.remaining ?? previous.lastRemaining ?? null,
      skipped: streak >= maxNoYield,
    };
  }
  return state;
}

export function autoProgress(pending, state, maxNoYield) {
  const skipped = pending.filter(entry => (state.attempts[entry.line]?.noYieldStreak || 0) >= maxNoYield);
  return { outstanding: pending.length, skipped: skipped.length,
    actionable: pending.length - skipped.length, skippedWords: skipped.map(entry => entry.line) };
}

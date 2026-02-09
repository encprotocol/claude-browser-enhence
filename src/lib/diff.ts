import type { DiffPart } from '@/types';

/**
 * Compute word-level diff between original and corrected text.
 * Uses LCS (Longest Common Subsequence) to detect changes.
 */
export function computeWordDiff(original: string, corrected: string): DiffPart[] {
  const origWords = original.split(/(\s+)/);
  const corrWords = corrected.split(/(\s+)/);

  const m = origWords.length;
  const n = corrWords.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origWords[i - 1] === corrWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const diff: DiffPart[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i - 1] === corrWords[j - 1]) {
      diff.unshift({ type: 'same', text: origWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'added', text: corrWords[j - 1] });
      j--;
    } else {
      diff.unshift({ type: 'removed', text: origWords[i - 1] });
      i--;
    }
  }
  return diff;
}

/**
 * Format diff for terminal display with ANSI codes.
 */
export function formatDiff(diff: DiffPart[]): string {
  let result = '';
  for (const part of diff) {
    if (part.type === 'removed') {
      result += `\x1b[9;31m${part.text}\x1b[0m`;
    } else if (part.type === 'added') {
      result += `\x1b[1;32m${part.text}\x1b[0m`;
    } else {
      result += part.text;
    }
  }
  return result;
}

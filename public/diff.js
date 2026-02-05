/**
 * Word-level diff algorithm for English correction feature
 * Uses LCS (Longest Common Subsequence) to detect changes
 */

/**
 * Compute word-level diff between original and corrected text
 * @param {string} original - Original text
 * @param {string} corrected - Corrected text
 * @returns {Array<{type: 'same'|'added'|'removed', text: string}>} - Diff result
 */
function computeWordDiff(original, corrected) {
  const origWords = original.split(/(\s+)/);
  const corrWords = corrected.split(/(\s+)/);

  // Simple LCS-based diff
  const m = origWords.length;
  const n = corrWords.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origWords[i - 1] === corrWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff
  const diff = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i - 1] === corrWords[j - 1]) {
      diff.unshift({ type: 'same', text: origWords[i - 1] });
      i--; j--;
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
 * Format diff for terminal display with ANSI codes
 * @param {Array<{type: 'same'|'added'|'removed', text: string}>} diff - Diff result
 * @returns {string} - Formatted string with ANSI codes
 */
function formatDiff(diff) {
  let result = '';
  for (const part of diff) {
    if (part.type === 'removed') {
      // Red strikethrough
      result += `\x1b[9;31m${part.text}\x1b[0m`;
    } else if (part.type === 'added') {
      // Green bold
      result += `\x1b[1;32m${part.text}\x1b[0m`;
    } else {
      result += part.text;
    }
  }
  return result;
}

// Export for browser
if (typeof window !== 'undefined') {
  window.Diff = {
    computeWordDiff,
    formatDiff
  };
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeWordDiff, formatDiff };
}

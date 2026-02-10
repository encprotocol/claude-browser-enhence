/**
 * Wrap each line of an HTML string in a <span class="code-line"> element.
 * CSS counters on .code-line::before render the line numbers.
 *
 * highlight.js can produce <span> tags that span multiple lines (e.g. code
 * blocks in markdown). A naive split('\n') breaks those spans, producing
 * malformed HTML that the browser "fixes" unpredictably — shifting line
 * numbers.  We track the stack of open <span> tags and close/reopen them
 * at every line boundary so each .code-line contains well-formed HTML.
 */

const OPEN_TAG_RE = /<span\b[^>]*>/g;
const CLOSE_TAG_RE = /<\/span>/g;

export function wrapLinesHtml(html: string): string {
  const lines = html.split('\n');
  // Stack of full opening tags inherited from previous lines
  let inherited: string[] = [];

  return lines
    .map((rawLine) => {
      // Re-open inherited tags at start of this line
      const prefix = inherited.join('');

      // Walk the line to figure out which tags are still open at the end
      const stack = [...inherited];
      let openMatch: RegExpExecArray | null;
      let closeMatch: RegExpExecArray | null;

      // Collect positions of opens and closes, process in document order
      const events: { pos: number; type: 'open' | 'close'; tag?: string }[] = [];

      OPEN_TAG_RE.lastIndex = 0;
      while ((openMatch = OPEN_TAG_RE.exec(rawLine)) !== null) {
        events.push({ pos: openMatch.index, type: 'open', tag: openMatch[0] });
      }
      CLOSE_TAG_RE.lastIndex = 0;
      while ((closeMatch = CLOSE_TAG_RE.exec(rawLine)) !== null) {
        events.push({ pos: closeMatch.index, type: 'close' });
      }

      // Sort by position (stable — opens before closes at same position)
      events.sort((a, b) => a.pos - b.pos || (a.type === 'open' ? -1 : 1));

      for (const ev of events) {
        if (ev.type === 'open') {
          stack.push(ev.tag!);
        } else {
          stack.pop();
        }
      }

      // Close any still-open tags at end of this line
      const suffix = '</span>'.repeat(stack.length);

      // Update inherited for next line
      inherited = stack;

      return `<span class="code-line">${prefix}${rawLine}${suffix}</span>`;
    })
    .join('');
}

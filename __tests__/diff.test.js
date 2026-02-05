const { computeWordDiff, formatDiff } = require('../public/diff');

describe('computeWordDiff', () => {
  test('identical text returns all same types', () => {
    const diff = computeWordDiff('hello world', 'hello world');
    expect(diff.every(part => part.type === 'same')).toBe(true);
    expect(diff.map(p => p.text).join('')).toBe('hello world');
  });

  test('simple word replacement detected', () => {
    const diff = computeWordDiff('I want to making', 'I want to make');
    const removed = diff.filter(p => p.type === 'removed');
    const added = diff.filter(p => p.type === 'added');
    expect(removed.some(p => p.text === 'making')).toBe(true);
    expect(added.some(p => p.text === 'make')).toBe(true);
  });

  test('word additions detected', () => {
    const diff = computeWordDiff('I go store', 'I go to the store');
    const added = diff.filter(p => p.type === 'added');
    expect(added.some(p => p.text === 'to')).toBe(true);
    expect(added.some(p => p.text === 'the')).toBe(true);
  });

  test('word deletions detected', () => {
    const diff = computeWordDiff('I want to to go', 'I want to go');
    const removed = diff.filter(p => p.type === 'removed');
    expect(removed.some(p => p.text === 'to')).toBe(true);
  });

  test('whitespace preservation', () => {
    const diff = computeWordDiff('hello  world', 'hello  world');
    const result = diff.map(p => p.text).join('');
    expect(result).toBe('hello  world');
  });

  test('empty original string', () => {
    const diff = computeWordDiff('', 'hello');
    const nonEmpty = diff.filter(p => p.text !== '');
    expect(nonEmpty.length).toBe(1);
    expect(nonEmpty[0]).toEqual({ type: 'added', text: 'hello' });
  });

  test('empty corrected string', () => {
    const diff = computeWordDiff('hello', '');
    const nonEmpty = diff.filter(p => p.text !== '');
    expect(nonEmpty.length).toBe(1);
    expect(nonEmpty[0]).toEqual({ type: 'removed', text: 'hello' });
  });

  test('both strings empty', () => {
    const diff = computeWordDiff('', '');
    expect(diff.length).toBe(1);
    expect(diff[0]).toEqual({ type: 'same', text: '' });
  });

  test('grammar correction: subject-verb agreement', () => {
    const diff = computeWordDiff('He go to school', 'He goes to school');
    const removed = diff.filter(p => p.type === 'removed');
    const added = diff.filter(p => p.type === 'added');
    expect(removed.some(p => p.text === 'go')).toBe(true);
    expect(added.some(p => p.text === 'goes')).toBe(true);
  });

  test('grammar correction: article addition', () => {
    const diff = computeWordDiff('I saw cat', 'I saw a cat');
    const added = diff.filter(p => p.type === 'added');
    expect(added.some(p => p.text === 'a')).toBe(true);
  });
});

describe('formatDiff', () => {
  test('same text has no ANSI codes', () => {
    const diff = [{ type: 'same', text: 'hello' }];
    const result = formatDiff(diff);
    expect(result).toBe('hello');
  });

  test('removed text has red strikethrough', () => {
    const diff = [{ type: 'removed', text: 'old' }];
    const result = formatDiff(diff);
    expect(result).toBe('\x1b[9;31mold\x1b[0m');
  });

  test('added text has green bold', () => {
    const diff = [{ type: 'added', text: 'new' }];
    const result = formatDiff(diff);
    expect(result).toBe('\x1b[1;32mnew\x1b[0m');
  });

  test('mixed diff formats correctly', () => {
    const diff = [
      { type: 'same', text: 'I ' },
      { type: 'removed', text: 'go' },
      { type: 'added', text: 'went' },
      { type: 'same', text: ' home' }
    ];
    const result = formatDiff(diff);
    expect(result).toBe('I \x1b[9;31mgo\x1b[0m\x1b[1;32mwent\x1b[0m home');
  });

  test('empty diff returns empty string', () => {
    const result = formatDiff([]);
    expect(result).toBe('');
  });
});

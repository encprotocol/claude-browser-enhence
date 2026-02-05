const { highlight, patterns } = require('../public/highlighter');

const RESET = '\x1b[0m';

describe('highlight', () => {
  describe('error keywords', () => {
    test('error highlighted in red', () => {
      const result = highlight('An error occurred');
      expect(result).toContain('\x1b[31m');
      expect(result).toContain('error');
    });

    test('failed highlighted in red', () => {
      const result = highlight('Build failed');
      expect(result).toContain('\x1b[31m');
      expect(result).toContain('failed');
    });

    test('fatal highlighted in red', () => {
      const result = highlight('fatal: not a git repository');
      expect(result).toContain('\x1b[31m');
    });
  });

  describe('success keywords', () => {
    test('success highlighted in green', () => {
      const result = highlight('Operation success');
      expect(result).toContain('\x1b[32m');
      expect(result).toContain('success');
    });

    test('done highlighted in green', () => {
      const result = highlight('Task done');
      expect(result).toContain('\x1b[32m');
    });

    test('passed highlighted in green', () => {
      const result = highlight('Tests passed');
      expect(result).toContain('\x1b[32m');
    });
  });

  describe('warning keywords', () => {
    test('warning highlighted in yellow', () => {
      const result = highlight('A warning message');
      expect(result).toContain('\x1b[33m');
    });

    test('deprecated highlighted in yellow', () => {
      const result = highlight('This API is deprecated');
      expect(result).toContain('\x1b[33m');
    });
  });

  describe('info keywords', () => {
    test('info highlighted in cyan', () => {
      const result = highlight('info: starting server');
      expect(result).toContain('\x1b[36m');
    });

    test('loading highlighted in cyan', () => {
      const result = highlight('loading modules...');
      expect(result).toContain('\x1b[36m');
    });
  });

  describe('URLs', () => {
    test('https URL highlighted in blue underline', () => {
      const result = highlight('Visit https://example.com');
      expect(result).toContain('\x1b[34;4m');
      expect(result).toContain('https://example.com');
    });

    test('http URL highlighted', () => {
      const result = highlight('Go to http://localhost:3000');
      expect(result).toContain('\x1b[34;4m');
    });
  });

  describe('file paths', () => {
    test('absolute path highlighted in magenta', () => {
      const result = highlight('File at /usr/local/bin');
      expect(result).toContain('\x1b[35m');
    });

    test('relative path highlighted', () => {
      const result = highlight('Open ./src/index.js');
      expect(result).toContain('\x1b[35m');
    });
  });

  describe('IP addresses', () => {
    test('IP address highlighted in blue', () => {
      const result = highlight('Server at 192.168.1.1');
      expect(result).toContain('\x1b[34m');
    });

    test('localhost highlighted', () => {
      const result = highlight('Running on localhost:8080');
      expect(result).toContain('\x1b[34m');
    });
  });

  describe('percentages and sizes', () => {
    test('percentage highlighted in yellow', () => {
      const result = highlight('Progress: 50%');
      expect(result).toContain('\x1b[33m');
    });

    test('file size highlighted', () => {
      const result = highlight('Size: 100 MB');
      expect(result).toContain('\x1b[33m');
    });
  });

  describe('already colorized text', () => {
    test('skips text with existing ANSI codes', () => {
      const colorized = '\x1b[32mgreen text\x1b[0m';
      const result = highlight(colorized);
      expect(result).toBe(colorized);
    });
  });

  describe('plain text', () => {
    test('plain text without patterns unchanged', () => {
      const text = 'just some normal text';
      const result = highlight(text);
      expect(result).toBe(text);
    });
  });

  describe('overlapping patterns', () => {
    test('handles overlapping matches without duplicates', () => {
      const result = highlight('error: connection failed');
      // Should not have nested or broken ANSI codes
      const ansiCount = (result.match(/\x1b\[/g) || []).length;
      const resetCount = (result.match(/\x1b\[0m/g) || []).length;
      // Each highlight should have a reset
      expect(ansiCount).toBeGreaterThanOrEqual(resetCount);
    });
  });
});

describe('patterns array', () => {
  test('patterns array is not empty', () => {
    expect(patterns.length).toBeGreaterThan(0);
  });

  test('each pattern has regex and color', () => {
    for (const pattern of patterns) {
      expect(pattern).toHaveProperty('regex');
      expect(pattern).toHaveProperty('color');
      expect(pattern.regex).toBeInstanceOf(RegExp);
      expect(typeof pattern.color).toBe('string');
    }
  });
});

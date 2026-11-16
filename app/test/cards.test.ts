// What a card shows of the thing being approved, and the lines-changed count.
import { test, expect } from 'vitest';
import { fullSummary, permissionView, MAX_SUMMARY } from '../src/main/format';
import { ChangeTracker, callChange, changeText } from '../src/main/changes';

test('card summary: the whole command is kept, with its line breaks', () => {
  const command = `echo start\n${'npm run build && '.repeat(60)}\r\nrm -rf /important`;
  const s = fullSummary({ command, description: 'Build' });
  expect(s.cut).toBe(false);
  expect(s.text.endsWith('rm -rf /important')).toBe(true);
  expect(s.text.split('\n').length).toBe(3);
  expect(s.text.includes('\r')).toBe(false);
});

test('card summary: a command too long to send is marked as cut', () => {
  const view = permissionView('1', { tool_name: 'Bash', tool_input: { command: 'x'.repeat(MAX_SUMMARY + 10) } });
  expect(view.summary.length).toBe(MAX_SUMMARY);
  expect(view.summaryCut).toBe(true);
  expect(permissionView('2', { tool_name: 'Bash', tool_input: { command: 'npm test' } }).summaryCut).toBeUndefined();
});

test('card summary: other tools show their path, address or the input itself', () => {
  expect(fullSummary({ file_path: 'C:\\a\\b.ts' }).text).toBe('C:\\a\\b.ts');
  expect(fullSummary({ url: 'https://example.com' }).text).toBe('https://example.com');
  expect(fullSummary({ subject: 'Fix', count: 2 }).text).toContain('"subject": "Fix"');
  expect(fullSummary({}).text).toBe('');
  expect(fullSummary(null).text).toBe('');
});

test('line counts: Edit, MultiEdit and Write', () => {
  const none = () => null;
  expect(callChange('Edit', { file_path: 'a.ts', old_string: 'a\nb', new_string: 'a\nc\nd' }, none)).toEqual({ added: 2, removed: 1 });
  expect(callChange('MultiEdit', { file_path: 'a.ts', edits: [{ old_string: 'x', new_string: 'y' }, { old_string: 'p', new_string: 'p\nq' }] }, none)).toEqual({ added: 2, removed: 1 });
  expect(callChange('Write', { file_path: 'new.ts', content: 'one\ntwo' }, none)).toEqual({ added: 2, removed: 0 });
  expect(callChange('Write', { file_path: 'old.ts', content: 'one\nthree' }, () => 'one\ntwo')).toEqual({ added: 1, removed: 1 });
  expect(callChange('Bash', { command: 'ls' }, none)).toBe(null);
  expect(callChange('Edit', { old_string: 'a', new_string: 'b' }, none)).toBe(null);
});

test('line counts: added only when the tool ran, per session, and reset by the next prompt', () => {
  const t = new ChangeTracker();
  const edit = { session_id: 's', tool_name: 'Edit', tool_use_id: 't1', tool_input: { file_path: 'a.ts', old_string: 'a', new_string: 'b\nc' } };
  expect(t.record({ ...edit, hook_event_name: 'PreToolUse' })).toBe(false);
  expect(t.get('s')).toBe(null);
  expect(t.record({ ...edit, hook_event_name: 'PostToolUse' })).toBe(true);
  expect(t.get('s')).toEqual({ added: 2, removed: 1 });
  // Reported twice: counted once.
  expect(t.record({ ...edit, hook_event_name: 'PostToolUse' })).toBe(false);

  const failed = { ...edit, tool_use_id: 't2' };
  t.record({ ...failed, hook_event_name: 'PreToolUse' });
  t.record({ ...failed, hook_event_name: 'PostToolUseFailure' });
  t.record({ ...failed, hook_event_name: 'PostToolUse' });
  expect(t.get('s')).toEqual({ added: 2, removed: 1 });

  const other = { ...edit, session_id: 'other', tool_use_id: 't3' };
  t.record({ ...other, hook_event_name: 'PreToolUse' });
  t.record({ ...other, hook_event_name: 'PostToolUse' });
  expect(t.get('other')).toEqual({ added: 2, removed: 1 });

  expect(t.record({ hook_event_name: 'UserPromptSubmit', session_id: 's' })).toBe(true);
  expect(t.get('s')).toBe(null);
  expect(t.get('other')).toEqual({ added: 2, removed: 1 });
});

test('line counts: the text on the banner', () => {
  expect(changeText({ added: 48, removed: 12 })).toBe('+48 −12');
  expect(changeText({ added: 3, removed: 0 })).toBe('+3');
  expect(changeText({ added: 0, removed: 0 })).toBe('');
  expect(changeText(null)).toBe('');
});

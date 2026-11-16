// Typing on a card (A5): an answer of the user's own, and feedback on a plan.
import { test, expect } from 'vitest';
import { buildAnswers, planRejection, typedText, MAX_TYPED } from '../src/main/format';

const questions = [
  { question: 'Which framework?', header: '', multi: false, options: [{ label: 'Vue', description: '' }, { label: 'React', description: '' }] },
  { question: 'Which checks?', header: '', multi: true, options: [{ label: 'Tests', description: '' }, { label: 'Lint', description: '' }] },
];

test('a typed answer stands in for a pick, and joins the picks on a pick-several question', () => {
  expect(buildAnswers(questions, [[], ['Lint']], ['  Svelte, with runes ', ''])).toEqual({ 'Which framework?': 'Svelte, with runes', 'Which checks?': 'Lint' });
  expect(buildAnswers(questions, [['Vue'], ['Tests']], ['', 'a type check'])).toEqual({ 'Which framework?': 'Vue', 'Which checks?': 'Tests, a type check' });
  expect(buildAnswers(questions, [['Vue'], []], ['', 'only this'])).toEqual({ 'Which framework?': 'Vue', 'Which checks?': 'only this' });
  // Typed text wins over a pick on a pick-one question.
  expect(buildAnswers(questions, [['Vue'], ['Lint']], ['Solid', ''])?.['Which framework?']).toBe('Solid');
});

test('typed answers: blank text is no answer, made-up labels are still refused, non-text is ignored', () => {
  expect(buildAnswers(questions, [[], ['Lint']], ['   ', ''])).toBeNull();
  expect(buildAnswers(questions, [['Angular'], ['Lint']], ['Solid', ''])).toBeNull();
  expect(buildAnswers(questions, [[], ['Lint']], [{ text: 'x' }, 5])).toBeNull();
  expect(buildAnswers(questions, [['Vue'], ['Lint']], 'nope')).toEqual({ 'Which framework?': 'Vue', 'Which checks?': 'Lint' });
  expect(buildAnswers(questions, [['Vue'], ['Lint']])).toEqual({ 'Which framework?': 'Vue', 'Which checks?': 'Lint' });
  expect(buildAnswers(questions, [[], ['Lint']], ['x'.repeat(MAX_TYPED + 500), ''])?.['Which framework?'].length).toBe(MAX_TYPED);
});

test('rejecting a plan: the feedback is passed on, and without it Claude is told to ask', () => {
  expect(planRejection('Helo', '  Keep the old API too. ')).toBe('The user rejected this plan from Helo and wrote this feedback: Keep the old API too.');
  expect(planRejection('Helo', '')).toContain('Ask what they would like changed');
  expect(planRejection('Helo', undefined)).toContain('Ask what they would like changed');
  expect(planRejection('Helo', 42)).toContain('Ask what they would like changed');
  expect(typedText(' a ')).toBe('a');
  expect(typedText(null)).toBe('');
});

import { reportError, setDiagnosticSink } from '../reportError';
afterEach(() => setDiagnosticSink());
it('never reports messages, stacks, locations or plant identifiers', () => {
  const send = jest.fn(); setDiagnosticSink(send);
  const error = Object.assign(new Error('Plant Alice at private address'), { code: 'firestore/unavailable', plantId: 'private' });
  reportError(error, 'save');
  expect(send).toHaveBeenCalledWith({ operation: 'save', code: 'unavailable', severity: 'error' });
  expect(JSON.stringify(send.mock.calls)).not.toContain('private');
});
it('normalizes unknown codes and isolates reporting failures', () => {
  const send = jest.fn(() => { throw new Error('Collector failed'); }); setDiagnosticSink(send);
  expect(() => reportError({ code: 'secret-value' }, 'render', true)).not.toThrow();
  expect(send).toHaveBeenCalledWith({ operation: 'render', code: 'unknown', severity: 'fatal' });
});

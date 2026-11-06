import oracles from './fixtures/bank-oracles-v7.5.json';
import { advance, bankStep, decide, initialize, refill, transition } from '../waterBank';
import { scenario } from './helpers';

describe('unaltered v7.5 fixed synthetic oracles, not calibrated hops profiles', () => {
  test.each(oracles.cases)('$id', c => {
    const orders = c.id === 'B10_storage_overflow' ? ['inputs_first', 'loss_first'] as const : ['inputs_first'] as const;
    const states = orders.map(order => {
      const s = { ...scenario, order, initialReserveL: [c.initial, c.initial] as const };
      let state = advance(initialize(s, 0, 'test', true), 3600, c.et0, c.rain, c.soil_rain === 'yes');
      if ('watering_now' in c) state = refill(state, c.watering_now ?? null, [.8, .8]);
      return state;
    });
    const reserves = [...new Set(states.flatMap(s => [...s.reserveL]))].sort((a, b) => a - b);
    expect(reserves).toHaveLength(c.expected_reserves.length);
    reserves.forEach((r, i) => expect(r).toBeCloseTo(c.expected_reserves[i], 10));
    expect(decide(states)).toBe(c.expected_candidate);
  });
});
test('conserves mass for both orderings across 1000 deterministic parameter sets', () => {
  let seed = 83;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 1000; i++) {
    const capacity = .1 + random() * 100; const reserve = random() * capacity; const input = random() * 200; const loss = random() * 200;
    for (const order of ['inputs_first', 'loss_first'] as const) {
      const next = bankStep(reserve, capacity, input, loss, order);
      expect(next.reserveL).toBeGreaterThanOrEqual(-1e-10); expect(next.reserveL).toBeLessThanOrEqual(capacity + 1e-10);
      expect(reserve + input).toBeCloseTo(next.reserveL + next.excessL + next.extractedL, 9);
      expect(next.extractedL).toBeLessThanOrEqual(loss);
    }
  }
});
test('no anchor means [0,C]; unknown retention and unknown amount never assert a full refill', () => {
  const state = initialize(scenario, 0, 'test');
  expect(state.reserveL).toEqual([0, 2]); expect(decide([state])).toBe('uncertain');
  expect(refill({ ...state, reserveL: [.2, .3] }, .5).reserveL).toEqual([.2, .8]);
  expect(refill({ ...state, reserveL: [.2, .3] }, null).reserveL[0]).toBeCloseTo(.28);
});
test('compatible demand change carries reserve, repot does not manufacture water', () => {
  const state = initialize(scenario, 100, 'test', true);
  expect(transition(state, { ...scenario, effectiveLossM2: .4 }, 'test', 100, true).reserveL).toEqual([1, 1]);
  expect(transition(state, { ...scenario, capacityL: 4 }, 'new-pot', 100, true).reserveL).toEqual([0, 4]);
  expect(() => transition(state, scenario, 'test', 101, true)).toThrow('boundary_replay');
});
test.each([NaN, Infinity, -1])('invalid numeric input %s is rejected', n => expect(() => bankStep(1, 2, n, 0)).toThrow());

import type { PlantLog, WeatherCacheEntry } from '@/firestoreModels';
import { fetchLogsAndWeatherForRange } from '@/lib/logs/fetchLogsAndWeatherForRange';
import {
  evaluateWateringInsights,
  type PlantSummary,
  type WateringInsight,
} from '@/lib/suggestions/wateringSuggestions';
import { fetchWeather } from '@/lib/weather/fetchWeather';
import { parseWeatherData } from '@/lib/weather/parseWeatherData';
import { updateWeatherCache } from '@/lib/weather/updateFirestore';
import {
  addDays,
  addRangeLog,
  createRangeWindow,
  makeLog,
  makePlantSummary,
  makeWeatherEntry,
  setRangeWeather,
  startOfDay,
  toDateKey,
  type RangeMap,
} from './fixtures';

jest.mock('@/lib/logs/fetchLogsAndWeatherForRange', () => ({
  fetchLogsAndWeatherForRange: jest.fn(),
}));

jest.mock('@/lib/weather/fetchWeather', () => ({
  fetchWeather: jest.fn(),
}));

jest.mock('@/lib/weather/parseWeatherData', () => ({
  parseWeatherData: jest.fn(),
}));

jest.mock('@/lib/weather/updateFirestore', () => ({
  updateWeatherCache: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const fetchRangeMock = fetchLogsAndWeatherForRange as jest.MockedFunction<
  typeof fetchLogsAndWeatherForRange
>;
const fetchWeatherMock = fetchWeather as jest.MockedFunction<typeof fetchWeather>;
const parseWeatherDataMock = parseWeatherData as jest.MockedFunction<typeof parseWeatherData>;
const updateWeatherCacheMock = updateWeatherCache as jest.MockedFunction<
  typeof updateWeatherCache
>;

const NOW = new Date(2026, 1, 10, 12, 0, 0, 0);
const TODAY = startOfDay(NOW);
const TODAY_KEY = toDateKey(TODAY);
const YESTERDAY_KEY = toDateKey(addDays(TODAY, -1));
const TOMORROW_KEY = toDateKey(addDays(TODAY, 1));

type ScenarioWeatherInput = {
  dayOffset: number;
  weather: Partial<WeatherCacheEntry> | null;
  nightHumidity?: number;
};

type ScenarioLogInput = {
  dayOffset: number;
  hour: number;
  type?: PlantLog['type'];
};

type ScenarioExpectation = {
  resultCount?: number;
  needsWater?: boolean;
  daysSinceLastWater?: number;
  thresholdDays?: number;
  lastWaterSource?: WateringInsight['lastWaterSource'];
  mildewRiskLevel?: WateringInsight['mildewRiskLevel'];
  mildewShouldWarn?: boolean;
  mildewConsecutiveVeryHumidWarmDays?: number;
  reasonIncludes?: string[];
  fetchRangeCalls?: number;
  fetchWeatherCalls?: number;
};

type ScenarioCase = {
  name: string;
  plant?: Partial<PlantSummary>;
  weather?: ScenarioWeatherInput[];
  logs?: ScenarioLogInput[];
  expect: ScenarioExpectation;
};

function makeRange() {
  const range = createRangeWindow(TODAY, 6);
  setRangeWeather(range, TODAY_KEY, makeWeatherEntry(TODAY_KEY));
  setRangeWeather(range, YESTERDAY_KEY, makeWeatherEntry(YESTERDAY_KEY));
  setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY));
  return range;
}

function toScenarioPlantId(name: string): string {
  return `s-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`;
}

function weather(
  dayOffset: number,
  dayWeather: Partial<WeatherCacheEntry> | null,
  extras?: { nightHumidity?: number },
): ScenarioWeatherInput {
  return {
    dayOffset,
    weather: dayWeather,
    ...(extras ?? {}),
  };
}

function scenarioLog(
  dayOffset: number,
  hour: number,
  type: PlantLog['type'] = 'watering',
): ScenarioLogInput {
  return { dayOffset, hour, type };
}

function detailedTemps(day: number, night: number) {
  return {
    morn: null,
    day,
    eve: null,
    night,
    min: null,
    max: day,
  };
}

function applyWeatherScenarioInputs(
  range: RangeMap,
  weatherInputs: ScenarioWeatherInput[],
) {
  weatherInputs.forEach((weatherInput) => {
    const key = toDateKey(addDays(TODAY, weatherInput.dayOffset));
    if (weatherInput.weather === null) {
      setRangeWeather(range, key, null);
      return;
    }

    const dayWeather = makeWeatherEntry(
      key,
      weatherInput.weather,
    ) as WeatherCacheEntry & { nightHumidity?: number };

    if (typeof weatherInput.nightHumidity === 'number') {
      dayWeather.nightHumidity = weatherInput.nightHumidity;
    }
    setRangeWeather(range, key, dayWeather);
  });
}

function applyLogScenarioInputs(range: RangeMap, logInputs: ScenarioLogInput[]) {
  logInputs.forEach((logInput) => {
    const logDate = addDays(TODAY, logInput.dayOffset);
    logDate.setHours(logInput.hour, 0, 0, 0);
    addRangeLog(range, toDateKey(logDate), makeLog(logDate, logInput.type));
  });
}

function assertScenarioExpectations(
  insight: WateringInsight,
  expected: ScenarioExpectation,
) {
  if (expected.needsWater !== undefined) {
    expect(insight.needsWater).toBe(expected.needsWater);
  }
  if (expected.daysSinceLastWater !== undefined) {
    expect(insight.daysSinceLastWater).toBe(expected.daysSinceLastWater);
  }
  if (expected.thresholdDays !== undefined) {
    expect(insight.thresholdDays).toBe(expected.thresholdDays);
  }
  if (expected.lastWaterSource !== undefined) {
    expect(insight.lastWaterSource).toBe(expected.lastWaterSource);
  }
  if (expected.mildewRiskLevel !== undefined) {
    expect(insight.mildewRiskLevel).toBe(expected.mildewRiskLevel);
  }
  if (expected.mildewShouldWarn !== undefined) {
    expect(insight.mildewShouldWarn).toBe(expected.mildewShouldWarn);
  }
  if (expected.mildewConsecutiveVeryHumidWarmDays !== undefined) {
    expect(insight.mildewConsecutiveVeryHumidWarmDays).toBe(
      expected.mildewConsecutiveVeryHumidWarmDays,
    );
  }
  if (expected.reasonIncludes) {
    expected.reasonIncludes.forEach((fragment) => {
      expect(insight.reason).toContain(fragment);
    });
  }
}

const WATERING_BASE_SCENARIOS: ScenarioCase[] = [
  {
    name: 'water today: hot + dry and no water for multiple days',
    weather: [
      weather(0, { temperature: 33, humidity: 35, rainfall: 0 }),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-3, 9)],
    expect: {
      needsWater: true,
      daysSinceLastWater: 3,
      thresholdDays: 1,
      reasonIncludes: ['forecast high', 'humidity near'],
    },
  },
  {
    name: 'no water today: watered yesterday in mild weather',
    weather: [
      weather(0, { temperature: 24, humidity: 55, rainfall: 0 }),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-1, 12)],
    expect: {
      needsWater: false,
      daysSinceLastWater: 1,
      lastWaterSource: 'manual',
    },
  },
  {
    name: 'no watering guidance: missing location + missing weather today',
    plant: { location: undefined as any },
    weather: [weather(0, null)],
    expect: {
      needsWater: false,
      reasonIncludes: ['Weather data is still syncing'],
      fetchWeatherCalls: 0,
    },
  },
  {
    name: 'no water today: cool cloudy day plus forecast rain extends the window',
    weather: [
      weather(0, {
        temperature: 17,
        cloudCoverage: 82,
        humidity: 70,
        rainfall: 0,
      }),
      weather(1, { rainfall: 10 }),
    ],
    logs: [scenarioLog(-2, 9)],
    expect: {
      thresholdDays: 3,
      needsWater: false,
    },
  },
];

const RAIN_PATTERN_SCENARIOS: ScenarioCase[] = [
  {
    name: 'no water today: rain already provided water',
    weather: [weather(0, { rainfall: 12 })],
    expect: {
      needsWater: false,
      lastWaterSource: 'rain',
      daysSinceLastWater: 0,
      reasonIncludes: ['received about'],
    },
  },
  {
    name: 'no water today: rain expected tomorrow and still inside window',
    weather: [
      weather(0, { rainfall: 0, temperature: 23, humidity: 60 }),
      weather(1, { rainfall: 10 }),
    ],
    logs: [scenarioLog(-1, 8)],
    expect: {
      needsWater: false,
      reasonIncludes: ['expected tomorrow'],
    },
  },
  {
    name: 'light rain yesterday is not enough to replace watering',
    weather: [
      weather(-1, { rainfall: 4, temperature: 25, humidity: 50 }),
      weather(0, { rainfall: 0, temperature: 31, humidity: 40 }),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-4, 9)],
    expect: {
      needsWater: true,
      lastWaterSource: 'manual',
      daysSinceLastWater: 3.7,
      reasonIncludes: ['forecast high', 'humidity near'],
    },
  },
  {
    name: 'light rain today is non-meaningful when plant is already overdue',
    weather: [
      weather(0, { rainfall: 4, temperature: 34, humidity: 35 }),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-3, 9)],
    expect: {
      needsWater: true,
      lastWaterSource: 'manual',
      reasonIncludes: ['only light rain', 'forecast high', 'humidity near'],
    },
  },
  {
    name: 'non-meaningful rain spread across days does not count as full watering',
    weather: [
      weather(-2, { rainfall: 2, temperature: 26, humidity: 52 }),
      weather(-1, { rainfall: 4, temperature: 27, humidity: 50 }),
      weather(0, { rainfall: 2, temperature: 31, humidity: 40 }),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-5, 8)],
    expect: {
      needsWater: true,
      lastWaterSource: 'manual',
      reasonIncludes: ['forecast high', 'humidity near'],
    },
  },
  {
    name: 'heavy rain split across yesterday and two days ago suppresses watering in heat',
    weather: [
      weather(-2, { rainfall: 12, temperature: 26, humidity: 55 }),
      weather(-1, { rainfall: 13, temperature: 25, humidity: 58 }),
      weather(0, { rainfall: 0, temperature: 34, humidity: 35 }),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-5, 9)],
    expect: {
      needsWater: false,
      lastWaterSource: 'rain',
      daysSinceLastWater: 0,
      reasonIncludes: ['recent rainfall totaled'],
    },
  },
  {
    name: 'tomorrow light rain is ignored when plant is already dry',
    weather: [
      weather(0, { rainfall: 0, temperature: 33, humidity: 35 }),
      weather(1, { rainfall: 5 }),
    ],
    logs: [scenarioLog(-3, 9)],
    expect: {
      needsWater: true,
      reasonIncludes: ['forecast high', 'humidity near'],
    },
  },
  {
    name: 'massive rain today hard-resets watering state and advises skipping',
    weather: [
      weather(0, { rainfall: 35, temperature: 24, humidity: 70 }),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-5, 8)],
    expect: {
      needsWater: false,
      lastWaterSource: 'rain',
      daysSinceLastWater: 0,
      reasonIncludes: ['heavy rain likely soaked', 'skip watering for about'],
    },
  },
  {
    name: 'massive rain yesterday with scorching today still suppresses watering in current model',
    weather: [
      weather(-1, { rainfall: 30, temperature: 27, humidity: 65 }),
      weather(0, { rainfall: 0, temperature: 35, humidity: 38 }),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-6, 8)],
    expect: {
      needsWater: false,
      lastWaterSource: 'rain',
      daysSinceLastWater: 0,
      reasonIncludes: ['recent rainfall totaled', 'heat stress watch'],
    },
  },
];

const MILDEW_SCENARIOS: ScenarioCase[] = [
  {
    name: 'high humidity warm day triggers mildew warning while watering stays deferred',
    weather: [
      weather(0, { rainfall: 0, temperature: 23, humidity: 72 }),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-1, 10)],
    expect: {
      needsWater: false,
      mildewRiskLevel: 'high',
      mildewShouldWarn: true,
      reasonIncludes: ['Powdery mildew risk is high'],
    },
  },
  {
    name: 'cool cloudy humid conditions extend threshold but still keep mildew on watch',
    weather: [
      weather(0, {
        rainfall: 0,
        temperature: 18,
        humidity: 65,
        cloudCoverage: 82,
      }),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-2, 9)],
    expect: {
      needsWater: false,
      thresholdDays: 2.5,
      mildewRiskLevel: 'high',
      mildewShouldWarn: true,
    },
  },
  {
    name: 'outdoor humid mild with high wind lowers mildew pressure',
    weather: [
      weather(0, {
        rainfall: 0,
        temperature: 23,
        humidity: 70,
        windSpeed: 28,
      }),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-1, 9)],
    expect: {
      needsWater: false,
      mildewRiskLevel: 'watch',
      mildewShouldWarn: false,
    },
  },
  {
    name: 'outdoor humid mild with low wind escalates mildew pressure',
    weather: [
      weather(0, {
        rainfall: 0,
        temperature: 23,
        humidity: 70,
        windSpeed: 4,
      }),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-1, 9)],
    expect: {
      needsWater: false,
      mildewRiskLevel: 'very_high',
      mildewShouldWarn: true,
    },
  },
  {
    name: 'same daytime averages without condensation night stays lower mildew risk',
    weather: [
      weather(
        0,
        {
          rainfall: 0,
          temperature: 23,
          humidity: 64,
          dewPoint: 10,
          detailedTemps: detailedTemps(23, 16),
        },
        { nightHumidity: 82 },
      ),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-1, 9)],
    expect: {
      mildewRiskLevel: 'high',
      mildewShouldWarn: true,
    },
  },
  {
    name: 'same daytime averages with condensation night escalates mildew risk',
    weather: [
      weather(
        0,
        {
          rainfall: 0,
          temperature: 23,
          humidity: 64,
          dewPoint: 14,
          detailedTemps: detailedTemps(23, 15),
        },
        { nightHumidity: 82 },
      ),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-1, 9)],
    expect: {
      mildewRiskLevel: 'very_high',
      mildewShouldWarn: true,
      reasonIncludes: ['very high'],
    },
  },
  {
    name: 'mildew watch starts around 60% humidity in mild temperatures',
    weather: [weather(0, { temperature: 23, humidity: 60, rainfall: 0 })],
    logs: [scenarioLog(-1, 12)],
    expect: {
      needsWater: false,
      mildewRiskLevel: 'watch',
      mildewShouldWarn: false,
      reasonIncludes: ['Mildew watch'],
    },
  },
  {
    name: 'mildew high risk appears in warm 65-85% humidity conditions',
    weather: [weather(0, { temperature: 23, humidity: 70, rainfall: 0 })],
    logs: [scenarioLog(-1, 12)],
    expect: {
      mildewRiskLevel: 'high',
      mildewShouldWarn: true,
      reasonIncludes: ['Powdery mildew risk is high'],
    },
  },
  {
    name: 'mildew very high risk appears after three humid warm days in a row',
    weather: [
      weather(-2, { temperature: 22, humidity: 71 }),
      weather(-1, { temperature: 23, humidity: 74 }),
      weather(0, { temperature: 24, humidity: 76, rainfall: 0 }),
    ],
    logs: [scenarioLog(-1, 12)],
    expect: {
      mildewRiskLevel: 'very_high',
      mildewShouldWarn: true,
      mildewConsecutiveVeryHumidWarmDays: 3,
      reasonIncludes: ['very high'],
    },
  },
  {
    name: 'humid nights and warm days escalate mildew warning intensity',
    weather: [
      weather(-1, { temperature: 22, humidity: 66 }, { nightHumidity: 72 }),
      weather(0, { temperature: 23, humidity: 68, rainfall: 0 }, { nightHumidity: 75 }),
    ],
    logs: [scenarioLog(-1, 12)],
    expect: {
      mildewRiskLevel: 'very_high',
      mildewShouldWarn: true,
      reasonIncludes: ['humid nights with warm days'],
    },
  },
  {
    name: 'mildew risk is reduced in extreme heat even with high humidity',
    weather: [weather(0, { temperature: 32, humidity: 80, rainfall: 0 })],
    expect: {
      mildewRiskLevel: 'watch',
      mildewShouldWarn: false,
    },
  },
];

const HEAT_AND_COLD_STRESS_SCENARIOS: ScenarioCase[] = [
  {
    name: 'very hot and dry overdue plant needs water with heat stress warning',
    weather: [
      weather(0, { rainfall: 0, temperature: 35, humidity: 35, windSpeed: 10 }),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-3, 8)],
    expect: {
      needsWater: true,
      reasonIncludes: ['heat stress risk today', 'check for wilting'],
    },
  },
  {
    name: 'very hot but recently watered plant gets heat stress watch even without watering',
    weather: [
      weather(0, { rainfall: 0, temperature: 35, humidity: 52 }),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-1, 10)],
    expect: {
      needsWater: false,
      lastWaterSource: 'manual',
      reasonIncludes: ['heat stress watch'],
    },
  },
  {
    name: 'cool wet humid spell suppresses watering and warns about root rot risk',
    weather: [
      weather(-1, { rainfall: 10, temperature: 13, humidity: 86 }),
      weather(0, { rainfall: 6, temperature: 13, humidity: 86 }),
      weather(1, { rainfall: 5 }),
    ],
    logs: [scenarioLog(-4, 9)],
    expect: {
      needsWater: false,
      lastWaterSource: 'rain',
      reasonIncludes: ['root rot risk', 'avoid overwatering'],
    },
  },
  {
    name: 'cool dry overdue plant still needs water but with caution phrasing',
    weather: [
      weather(0, { rainfall: 0, temperature: 13, humidity: 60 }),
      weather(1, { rainfall: 0 }),
    ],
    logs: [scenarioLog(-3, 8)],
    expect: {
      needsWater: true,
      reasonIncludes: ['cool weather caution'],
    },
  },
];

const EDGE_SCENARIOS: ScenarioCase[] = [
  {
    name: 'inactive plant: returns no scenario insight',
    plant: { status: 'dead' as any },
    expect: {
      resultCount: 0,
      fetchRangeCalls: 0,
      fetchWeatherCalls: 0,
    },
  },
];

const SCENARIO_MATRIX: ScenarioCase[] = [
  ...WATERING_BASE_SCENARIOS,
  ...RAIN_PATTERN_SCENARIOS,
  ...MILDEW_SCENARIOS,
  ...HEAT_AND_COLD_STRESS_SCENARIOS,
  ...EDGE_SCENARIOS,
];

describe('watering suggestions - real-world intent scenario matrix', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    jest.clearAllMocks();
    fetchWeatherMock.mockResolvedValue({} as any);
    parseWeatherDataMock.mockReturnValue({});
    updateWeatherCacheMock.mockImplementation(async (_id, parsed) => parsed);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each(SCENARIO_MATRIX)('$name', async (scenario) => {
    const plantStatus = scenario.plant?.status;
    const shouldQueryRange = !(plantStatus && plantStatus !== 'active');
    const expectedRangeCalls =
      scenario.expect.fetchRangeCalls ?? (shouldQueryRange ? 1 : 0);

    const plant = makePlantSummary({
      id: toScenarioPlantId(scenario.name),
      ...(scenario.plant ?? {}),
    } as Partial<PlantSummary>);

    if (shouldQueryRange) {
      const range = makeRange();
      applyWeatherScenarioInputs(range, scenario.weather ?? []);
      applyLogScenarioInputs(range, scenario.logs ?? []);
      fetchRangeMock.mockResolvedValue(range);
    }

    const result = await evaluateWateringInsights([plant]);
    const expectedCount = scenario.expect.resultCount ?? 1;
    expect(result).toHaveLength(expectedCount);
    expect(fetchRangeMock).toHaveBeenCalledTimes(expectedRangeCalls);

    if (scenario.expect.fetchWeatherCalls !== undefined) {
      expect(fetchWeatherMock).toHaveBeenCalledTimes(
        scenario.expect.fetchWeatherCalls,
      );
    }

    if (!expectedCount) return;
    assertScenarioExpectations(result[0], scenario.expect);
  });
});

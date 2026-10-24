import { evaluateWateringInsights } from '@/lib/suggestions/wateringSuggestions';
import { fetchLogsAndWeatherForRange } from '@/lib/logs/fetchLogsAndWeatherForRange';
import { fetchWeather } from '@/lib/weather/fetchWeather';
import { parseWeatherData } from '@/lib/weather/parseWeatherData';
import { updateWeatherCache } from '@/lib/weather/updateFirestore';
import logger from '@/lib/logger';
import {
  addDays,
  addRangeLog,
  createRangeWindow,
  makeLog,
  makePlantSummary,
  makeTimestamp,
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
const updateWeatherCacheMock = updateWeatherCache as jest.MockedFunction<typeof updateWeatherCache>;
const loggerMock = logger as jest.Mocked<typeof logger>;

const FROZEN_NOW = new Date(2026, 1, 10, 12, 0, 0, 0);
const TODAY_START = startOfDay(FROZEN_NOW);
const TODAY_KEY = toDateKey(TODAY_START);
const YESTERDAY_KEY = toDateKey(addDays(TODAY_START, -1));
const TOMORROW_KEY = toDateKey(addDays(TODAY_START, 1));

function makeFullPathRange(lookbackDays = 6): RangeMap {
  const range = createRangeWindow(TODAY_START, lookbackDays);
  setRangeWeather(range, TODAY_KEY, makeWeatherEntry(TODAY_KEY));
  setRangeWeather(range, YESTERDAY_KEY, makeWeatherEntry(YESTERDAY_KEY));
  setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY));
  return range;
}

function makePlanBRange(lookbackDays = 6): RangeMap {
  const range = createRangeWindow(TODAY_START, lookbackDays);
  setRangeWeather(range, TODAY_KEY, makeWeatherEntry(TODAY_KEY));
  setRangeWeather(range, YESTERDAY_KEY, null);
  setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY));
  return range;
}

describe('evaluateWateringInsights (black-box)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FROZEN_NOW);
    jest.clearAllMocks();
    fetchWeatherMock.mockResolvedValue({} as any);
    parseWeatherDataMock.mockReturnValue({});
    updateWeatherCacheMock.mockImplementation(async (_id, parsed) => parsed);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('1) returns [] for empty input', async () => {
    const result = await evaluateWateringInsights([]);
    expect(result).toEqual([]);
    expect(fetchRangeMock).not.toHaveBeenCalled();
  });

  it('2) skips non-active plant', async () => {
    const archived = makePlantSummary({ id: 'p-archived', status: 'archived' as any });
    const result = await evaluateWateringInsights([archived]);
    expect(result).toEqual([]);
    expect(fetchRangeMock).not.toHaveBeenCalled();
  });

  it('3) uses default lookback (6) and end window (tomorrow)', async () => {
    const plant = makePlantSummary({ id: 'p-default-window' });
    fetchRangeMock.mockResolvedValue(makeFullPathRange(6));

    await evaluateWateringInsights([plant]);

    expect(fetchRangeMock).toHaveBeenCalledWith(
      plant.id,
      toDateKey(addDays(TODAY_START, -6)),
      toDateKey(addDays(TODAY_START, 1)),
      undefined,
    );
  });

  it('4) honors custom lookbackDays option', async () => {
    const plant = makePlantSummary({ id: 'p-custom-window' });
    fetchRangeMock.mockResolvedValue(makeFullPathRange(2));

    await evaluateWateringInsights([plant], { lookbackDays: 2 });

    expect(fetchRangeMock).toHaveBeenCalledWith(
      plant.id,
      toDateKey(addDays(TODAY_START, -2)),
      toDateKey(addDays(TODAY_START, 1)),
      undefined,
    );
  });

  it('5) omits plant when range fetch fails and logs error', async () => {
    const plant = makePlantSummary({ id: 'p-fetch-fail' });
    fetchRangeMock.mockRejectedValue(new Error('range failed'));

    const result = await evaluateWateringInsights([plant]);

    expect(result).toEqual([]);
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Failed to fetch logs/weather for plant',
      expect.objectContaining({ plantId: plant.id, error: expect.any(Error) }),
    );
  });

  it('6) mixed batch keeps successful insights when one fetch fails', async () => {
    const badPlant = makePlantSummary({ id: 'p-bad' });
    const goodPlant = makePlantSummary({ id: 'p-good' });

    fetchRangeMock.mockImplementation(async (plantId) => {
      if (plantId === badPlant.id) throw new Error('bad range');
      return makeFullPathRange(6);
    });

    const result = await evaluateWateringInsights([badPlant, goodPlant]);

    expect(result).toHaveLength(1);
    expect(result[0].plantId).toBe(goodPlant.id);
  });

  it('7) triggers weather refresh when today/tomorrow weather missing and coords exist', async () => {
    const plant = makePlantSummary({ id: 'p-refresh' });
    const range = createRangeWindow(TODAY_START, 6);
    setRangeWeather(range, YESTERDAY_KEY, makeWeatherEntry(YESTERDAY_KEY));
    setRangeWeather(range, TODAY_KEY, null);
    setRangeWeather(range, TOMORROW_KEY, null);

    const parsed = {
      [TODAY_KEY]: makeWeatherEntry(TODAY_KEY, { temperature: 27 }),
      [TOMORROW_KEY]: makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }),
    };

    fetchRangeMock.mockResolvedValue(range);
    parseWeatherDataMock.mockReturnValue(parsed as any);

    const result = await evaluateWateringInsights([plant]);

    expect(result).toHaveLength(1);
    expect(fetchWeatherMock).toHaveBeenCalledWith(plant.location!.lat, plant.location!.lng);
    expect(updateWeatherCacheMock).toHaveBeenCalledWith(plant.id, parsed, expect.objectContaining({ location: plant.location }));
  });

  it('8) does not refresh weather when coordinates are missing', async () => {
    const plant = makePlantSummary({ id: 'p-no-coords', location: undefined as any });
    const range = makeFullPathRange(6);
    setRangeWeather(range, TOMORROW_KEY, null);
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight).toBeDefined();
    expect(fetchWeatherMock).not.toHaveBeenCalled();
    expect(updateWeatherCacheMock).not.toHaveBeenCalled();
  });

  it('9) refresh failure does not throw and falls back safely', async () => {
    const plant = makePlantSummary({ id: 'p-refresh-fail' });
    const range = createRangeWindow(TODAY_START, 6);
    setRangeWeather(range, YESTERDAY_KEY, makeWeatherEntry(YESTERDAY_KEY));
    setRangeWeather(range, TODAY_KEY, null);
    setRangeWeather(range, TOMORROW_KEY, null);
    fetchRangeMock.mockResolvedValue(range);
    fetchWeatherMock.mockRejectedValue(new Error('weather API down'));

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.reason).toContain('Weather data is still syncing');
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Failed to refresh weather for plant',
      expect.objectContaining({ plantId: plant.id, error: expect.any(Error) }),
    );
  });

  it('10) missing today weather after fallback returns neutral/manual-check insight', async () => {
    const plant = makePlantSummary({ id: 'p-missing-today', location: undefined as any });
    const range = createRangeWindow(TODAY_START, 6);
    setRangeWeather(range, YESTERDAY_KEY, makeWeatherEntry(YESTERDAY_KEY));
    setRangeWeather(range, TODAY_KEY, null);
    setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY));
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.needsWater).toBe(false);
    expect(insight.lastWaterSource).toBe('unknown');
    expect(insight.score).toBe(0);
    expect(insight.reason).toContain('Weather data is still syncing');
  });

  it('11) Plan B is used when yesterday weather is missing and today exists', async () => {
    const plant = makePlantSummary({ id: 'p-plan-b' });
    fetchRangeMock.mockResolvedValue(makePlanBRange(6));

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.score).toBe(0);
    expect(insight.daysSinceLastWater).toBe(1);
    expect(insight.lastWaterSource).toBe('unknown');
    expect(insight.reason).toContain('Using current and forecast data only');
  });

  it('12) Plan B with today rain above threshold marks needsWater=false', async () => {
    const plant = makePlantSummary({ id: 'p-plan-b-rain' });
    const range = makePlanBRange(6);
    setRangeWeather(range, TODAY_KEY, makeWeatherEntry(TODAY_KEY, { rainfall: 10 }));
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.needsWater).toBe(false);
    expect(insight.todayRainfall).toBe(10);
  });

  it('13) Plan B with no significant rain and hot forecast marks needsWater=true', async () => {
    const plant = makePlantSummary({ id: 'p-plan-b-hot' });
    const range = makePlanBRange(6);
    setRangeWeather(range, TODAY_KEY, makeWeatherEntry(TODAY_KEY, { temperature: 35, rainfall: 0 }));
    setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.needsWater).toBe(true);
    expect(insight.reason).toContain('Forecast is sunny/hot');
  });

  it('14) picks manual as lastWaterSource when manual event is newer than rain', async () => {
    const plant = makePlantSummary({ id: 'p-manual-newer' });
    const range = makeFullPathRange(6);
    const rainDay = toDateKey(addDays(TODAY_START, -3));
    setRangeWeather(range, rainDay, makeWeatherEntry(rainDay, { rainfall: 2 }));

    const manualAt = new Date(TODAY_START);
    manualAt.setDate(manualAt.getDate() - 1);
    manualAt.setHours(15, 0, 0, 0);
    addRangeLog(range, YESTERDAY_KEY, makeLog(manualAt, 'watering'));

    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.lastWaterSource).toBe('manual');
    expect(insight.daysSinceLastWater).toBe(1);
  });

  it('15) picks rain as lastWaterSource when rain event is newer than manual', async () => {
    const plant = makePlantSummary({ id: 'p-rain-newer' });
    const range = makeFullPathRange(6);

    const manualAt = new Date(TODAY_START);
    manualAt.setDate(manualAt.getDate() - 5);
    manualAt.setHours(10, 0, 0, 0);
    addRangeLog(range, toDateKey(addDays(TODAY_START, -5)), makeLog(manualAt, 'watering'));

    setRangeWeather(range, YESTERDAY_KEY, makeWeatherEntry(YESTERDAY_KEY, { rainfall: 10 }));

    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.lastWaterSource).toBe('rain');
    expect(insight.daysSinceLastWater).toBe(1);
  });

  it('16) created-today + no history currently resolves via Plan B fallback behavior', async () => {
    const plant = makePlantSummary({
      id: 'p-created-today',
      createdAt: makeTimestamp(TODAY_START),
    } as any);
    fetchRangeMock.mockResolvedValue(makePlanBRange(6));

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.daysSinceLastWater).toBe(1);
    expect(insight.reason).toContain('Using current and forecast data only');
  });

  it('17) older createdAt + no history currently resolves via Plan B fallback behavior', async () => {
    const oldCreatedAt = addDays(TODAY_START, -30);
    const plant = makePlantSummary({
      id: 'p-created-old',
      createdAt: makeTimestamp(oldCreatedAt),
    } as any);
    fetchRangeMock.mockResolvedValue(makePlanBRange(6));

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.daysSinceLastWater).toBe(1);
    expect(insight.reason).toContain('Using current and forecast data only');
  });

  it('18) base thresholdDays by environment are indoor=3, greenhouse=2.5, outdoor=2', async () => {
    const indoor = makePlantSummary({ id: 'p-indoor', environment: 'indoor' });
    const greenhouse = makePlantSummary({ id: 'p-greenhouse', environment: 'greenhouse' });
    const outdoor = makePlantSummary({ id: 'p-outdoor', environment: 'outdoor' });
    fetchRangeMock.mockResolvedValue(makePlanBRange(6));

    const result = await evaluateWateringInsights([indoor, greenhouse, outdoor]);
    const byPlant = new Map(result.map((r) => [r.plantId, r]));

    expect(byPlant.get(indoor.id)?.thresholdDays).toBe(3);
    expect(byPlant.get(greenhouse.id)?.thresholdDays).toBe(2.5);
    expect(byPlant.get(outdoor.id)?.thresholdDays).toBe(2);
  });

  it('19) climate reductions apply (very hot/hot/low-humidity)', async () => {
    const plant = makePlantSummary({ id: 'p-climate-reduce' });

    const veryHotRange = makeFullPathRange(6);
    setRangeWeather(veryHotRange, TODAY_KEY, makeWeatherEntry(TODAY_KEY, { temperature: 34, humidity: 60 }));
    setRangeWeather(veryHotRange, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(veryHotRange);
    const [veryHotInsight] = await evaluateWateringInsights([plant]);

    const hotLowHumidityRange = makeFullPathRange(6);
    setRangeWeather(
      hotLowHumidityRange,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { temperature: 31, humidity: 40 }),
    );
    setRangeWeather(hotLowHumidityRange, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(hotLowHumidityRange);
    const [hotLowHumidityInsight] = await evaluateWateringInsights([plant]);

    expect(veryHotInsight.thresholdDays).toBe(1.25);
    expect(hotLowHumidityInsight.thresholdDays).toBe(1.2);
  });

  it('20) climate increases and clamping keep thresholdDays in [1, 4]', async () => {
    const indoorPlant = makePlantSummary({ id: 'p-clamp-high', environment: 'indoor' });
    const highRange = makeFullPathRange(6);
    setRangeWeather(
      highRange,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { temperature: 18, cloudCoverage: 80, humidity: 60 }),
    );
    setRangeWeather(highRange, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 10 }));
    fetchRangeMock.mockResolvedValueOnce(highRange);
    const [highInsight] = await evaluateWateringInsights([indoorPlant]);

    const outdoorPlant = makePlantSummary({ id: 'p-clamp-low', environment: 'outdoor' });
    const lowRange = makeFullPathRange(6);
    setRangeWeather(
      lowRange,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { temperature: 35, humidity: 20, cloudCoverage: 20 }),
    );
    setRangeWeather(lowRange, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(lowRange);
    const [lowInsight] = await evaluateWateringInsights([outdoorPlant]);

    expect(highInsight.thresholdDays).toBe(4);
    expect(lowInsight.thresholdDays).toBe(1);
  });

  it('21) dryness decision and today-rain override behave as expected', async () => {
    const plant = makePlantSummary({ id: 'p-dryness' });

    const dryRange = makeFullPathRange(6);
    setRangeWeather(dryRange, TODAY_KEY, makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 24, humidity: 55 }));
    setRangeWeather(dryRange, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(dryRange);
    const [dryInsight] = await evaluateWateringInsights([plant]);

    const rainRange = makeFullPathRange(6);
    setRangeWeather(rainRange, TODAY_KEY, makeWeatherEntry(TODAY_KEY, { rainfall: 10 }));
    setRangeWeather(rainRange, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(rainRange);
    const [rainOverrideInsight] = await evaluateWateringInsights([plant]);

    expect(dryInsight.needsWater).toBe(true);
    expect(rainOverrideInsight.needsWater).toBe(false);
    expect(rainOverrideInsight.daysSinceLastWater).toBe(0);
    expect(rainOverrideInsight.lastWaterSource).toBe('rain');
  });

  it('22) significant tomorrow rain only suppresses watering when still near threshold', async () => {
    const plant = makePlantSummary({ id: 'p-tomorrow-rain-lock' });

    const nearRange = makeFullPathRange(6);
    const nearManual = new Date(TODAY_START);
    nearManual.setDate(nearManual.getDate() - 1);
    nearManual.setHours(14, 0, 0, 0);
    addRangeLog(nearRange, YESTERDAY_KEY, makeLog(nearManual));
    setRangeWeather(nearRange, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 10 }));
    fetchRangeMock.mockResolvedValueOnce(nearRange);
    const [nearInsight] = await evaluateWateringInsights([plant]);

    const farRange = makeFullPathRange(6);
    const farManual = new Date(TODAY_START);
    farManual.setDate(farManual.getDate() - 4);
    farManual.setHours(14, 0, 0, 0);
    addRangeLog(farRange, toDateKey(addDays(TODAY_START, -4)), makeLog(farManual));
    setRangeWeather(farRange, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 10 }));
    fetchRangeMock.mockResolvedValueOnce(farRange);
    const [farInsight] = await evaluateWateringInsights([plant]);

    expect(nearInsight.needsWater).toBe(false);
    expect(farInsight.needsWater).toBe(true);
    expect(farInsight.daysSinceLastWater).toBe(4);
  });

  it('23) keeps full-path evaluation when yesterday weather is missing but older watering context exists', async () => {
    const plant = makePlantSummary({ id: 'p-gap-with-history' });
    const range = createRangeWindow(TODAY_START, 6);
    setRangeWeather(
      range,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 30, humidity: 40 }),
    );
    setRangeWeather(range, YESTERDAY_KEY, null);
    setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));

    const olderManual = new Date(TODAY_START);
    olderManual.setDate(olderManual.getDate() - 3);
    olderManual.setHours(10, 0, 0, 0);
    addRangeLog(range, toDateKey(addDays(TODAY_START, -3)), makeLog(olderManual, 'watering'));
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.reason).not.toContain('Using current and forecast data only');
    expect(insight.lastWaterSource).toBe('manual');
    expect(insight.daysSinceLastWater).toBe(3);
  });

  it('24) forecasted rain for today does not hard-reset watering state as observed rain', async () => {
    const plant = makePlantSummary({ id: 'p-forecast-rain-today' });
    const range = makeFullPathRange(6);

    const manualAt = new Date(TODAY_START);
    manualAt.setDate(manualAt.getDate() - 3);
    manualAt.setHours(9, 0, 0, 0);
    addRangeLog(range, toDateKey(addDays(TODAY_START, -3)), makeLog(manualAt, 'watering'));

    setRangeWeather(
      range,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, {
        rainfall: 12,
        temperature: 34,
        humidity: 35,
        forecasted: true,
      }),
    );
    setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.needsWater).toBe(true);
    expect(insight.lastWaterSource).toBe('manual');
    expect(insight.daysSinceLastWater).toBe(3);
  });

  it('25) score stays below 1 when tomorrow-rain suppression flips needsWater to false', async () => {
    const plant = makePlantSummary({ id: 'p-score-consistent' });
    const range = makeFullPathRange(6);

    const manualAt = new Date(TODAY_START);
    manualAt.setDate(manualAt.getDate() - 2);
    manualAt.setHours(14, 0, 0, 0);
    addRangeLog(range, toDateKey(addDays(TODAY_START, -2)), makeLog(manualAt, 'watering'));

    setRangeWeather(
      range,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 33, humidity: 50 }),
    );
    setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 10 }));
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.needsWater).toBe(false);
    expect(insight.score).toBe(0.99);
  });

  it('26) potSize modifier: small pots dry faster than large pots', async () => {
    const smallPotPlant = makePlantSummary({ id: 'p-small-pot', potSize: '3L' });
    const largePotPlant = makePlantSummary({ id: 'p-large-pot', potSize: '50L' });

    const rangeForSmallPot = makeFullPathRange(6);
    setRangeWeather(
      rangeForSmallPot,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 31, humidity: 50 }),
    );
    setRangeWeather(rangeForSmallPot, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(rangeForSmallPot);
    const [smallPotInsight] = await evaluateWateringInsights([smallPotPlant]);

    const rangeForLargePot = makeFullPathRange(6);
    setRangeWeather(
      rangeForLargePot,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 31, humidity: 50 }),
    );
    setRangeWeather(rangeForLargePot, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(rangeForLargePot);
    const [largePotInsight] = await evaluateWateringInsights([largePotPlant]);

    expect(smallPotInsight.thresholdDays).toBe(1.15);
    expect(largePotInsight.thresholdDays).toBe(1.7);
    expect(smallPotInsight.thresholdDays).toBeLessThan(largePotInsight.thresholdDays);
  });

  it('27) growth stage modifier: seedling is more sensitive than flowering', async () => {
    const seedlingPlant = makePlantSummary({ id: 'p-seedling', growthStage: 'seedling' });
    const floweringPlant = makePlantSummary({ id: 'p-flowering', growthStage: 'flowering' });

    const rangeForSeedling = makeFullPathRange(6);
    setRangeWeather(
      rangeForSeedling,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 30, humidity: 48 }),
    );
    setRangeWeather(rangeForSeedling, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(rangeForSeedling);
    const [seedlingInsight] = await evaluateWateringInsights([seedlingPlant]);

    const rangeForFlowering = makeFullPathRange(6);
    setRangeWeather(
      rangeForFlowering,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 30, humidity: 48 }),
    );
    setRangeWeather(rangeForFlowering, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(rangeForFlowering);
    const [floweringInsight] = await evaluateWateringInsights([floweringPlant]);

    expect(seedlingInsight.thresholdDays).toBe(1.15);
    expect(floweringInsight.thresholdDays).toBe(1.5);
    expect(seedlingInsight.thresholdDays).toBeLessThan(floweringInsight.thresholdDays);
  });

  it('28) sunlight modifier: full sun dries faster than shade and can flip decision', async () => {
    const fullSunPlant = makePlantSummary({ id: 'p-full-sun', sunlightExposure: 'full sun' });
    const shadePlant = makePlantSummary({ id: 'p-shade', sunlightExposure: 'shade' });

    const rangeForFullSun = makeFullPathRange(6);
    const fullSunManual = new Date(TODAY_START);
    fullSunManual.setDate(fullSunManual.getDate() - 2);
    fullSunManual.setHours(9, 0, 0, 0);
    addRangeLog(rangeForFullSun, toDateKey(addDays(TODAY_START, -2)), makeLog(fullSunManual, 'watering'));
    setRangeWeather(
      rangeForFullSun,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 29, humidity: 52 }),
    );
    setRangeWeather(rangeForFullSun, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(rangeForFullSun);
    const [fullSunInsight] = await evaluateWateringInsights([fullSunPlant]);

    const rangeForShade = makeFullPathRange(6);
    const shadeManual = new Date(TODAY_START);
    shadeManual.setDate(shadeManual.getDate() - 2);
    shadeManual.setHours(9, 0, 0, 0);
    addRangeLog(rangeForShade, toDateKey(addDays(TODAY_START, -2)), makeLog(shadeManual, 'watering'));
    setRangeWeather(
      rangeForShade,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 29, humidity: 52 }),
    );
    setRangeWeather(rangeForShade, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(rangeForShade);
    const [shadeInsight] = await evaluateWateringInsights([shadePlant]);

    expect(fullSunInsight.thresholdDays).toBe(1.75);
    expect(shadeInsight.thresholdDays).toBe(2.2);
    expect(fullSunInsight.needsWater).toBe(true);
    expect(shadeInsight.needsWater).toBe(false);
  });

  it('29) Plan B includes tomorrow rain fragment when only tomorrow exceeds threshold', async () => {
    const plant = makePlantSummary({ id: 'p-planb-tomorrow-rain' });
    const range = makePlanBRange(6);
    setRangeWeather(range, TODAY_KEY, makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 24 }));
    setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 10 }));
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.needsWater).toBe(false);
    expect(insight.reason).toContain('Rain expected tomorrow');
  });

  it('30) Plan B includes light-rain fragment when today rain is below threshold', async () => {
    const plant = makePlantSummary({ id: 'p-planb-light-rain' });
    const range = makePlanBRange(6);
    setRangeWeather(range, TODAY_KEY, makeWeatherEntry(TODAY_KEY, { rainfall: 4, temperature: 24 }));
    setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.needsWater).toBe(true);
    expect(insight.reason).toContain('Only light rain fell today');
  });

  it('31) Plan B adds heat-stress watch when rain suppresses watering on hot day', async () => {
    const plant = makePlantSummary({ id: 'p-planb-heat-watch' });
    const range = makePlanBRange(6);
    setRangeWeather(range, TODAY_KEY, makeWeatherEntry(TODAY_KEY, { rainfall: 10, temperature: 35 }));
    setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.needsWater).toBe(false);
    expect(insight.reason).toContain('Heat stress watch');
  });

  it('32) Plan B adds cool-wet root rot warning when rain suppresses watering', async () => {
    const plant = makePlantSummary({ id: 'p-planb-root-rot' });
    const range = makePlanBRange(6);
    setRangeWeather(
      range,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 10, temperature: 13, humidity: 86 }),
    );
    setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.needsWater).toBe(false);
    expect(insight.reason).toContain('Cool wet conditions increase root rot risk');
  });

  it('33) forecasted light rain keeps watering active when plant is overdue', async () => {
    const plant = makePlantSummary({ id: 'p-forecast-light-rain-overdue' });
    const range = makeFullPathRange(6);
    const manualAt = new Date(TODAY_START);
    manualAt.setDate(manualAt.getDate() - 4);
    manualAt.setHours(9, 0, 0, 0);
    addRangeLog(range, toDateKey(addDays(TODAY_START, -4)), makeLog(manualAt, 'watering'));

    setRangeWeather(
      range,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 4, forecasted: true, temperature: 33, humidity: 35 }),
    );
    setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.needsWater).toBe(true);
    expect(insight.reason).toContain('only light rain (~4.0mm) is forecast today');
  });

  it('34) needs-water reason includes high-wind drying fragment when windy', async () => {
    const plant = makePlantSummary({ id: 'p-high-wind-reason' });
    const range = makeFullPathRange(6);
    const manualAt = new Date(TODAY_START);
    manualAt.setDate(manualAt.getDate() - 3);
    manualAt.setHours(10, 0, 0, 0);
    addRangeLog(range, toDateKey(addDays(TODAY_START, -3)), makeLog(manualAt, 'watering'));
    setRangeWeather(
      range,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 29, humidity: 50, windSpeed: 25 }),
    );
    setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.needsWater).toBe(true);
    expect(insight.reason).toContain('strong winds are increasing drying');
  });

  it('35) non-needs-water reason uses forecast-significant-rain fragment for unobserved today rain', async () => {
    const plant = makePlantSummary({ id: 'p-forecast-significant-rain' });
    const range = makeFullPathRange(6);
    const manualAt = new Date(TODAY_START);
    manualAt.setDate(manualAt.getDate() - 1);
    manualAt.setHours(10, 0, 0, 0);
    addRangeLog(range, YESTERDAY_KEY, makeLog(manualAt, 'watering'));
    setRangeWeather(
      range,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 10, forecasted: true, temperature: 24, humidity: 55 }),
    );
    setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.needsWater).toBe(false);
    expect(insight.reason).toContain('forecast suggests around 10.0mm of rain today');
  });

  it('36) near-threshold dryness now uses a small grace buffer before flipping to needs-water', async () => {
    const plant = makePlantSummary({ id: 'p-near-threshold-grace' });
    const range = makeFullPathRange(6);
    const manualAt = new Date(TODAY_START);
    manualAt.setDate(manualAt.getDate() - 2);
    manualAt.setHours(9, 0, 0, 0);
    addRangeLog(range, toDateKey(addDays(TODAY_START, -2)), makeLog(manualAt, 'watering'));
    setRangeWeather(
      range,
      YESTERDAY_KEY,
      makeWeatherEntry(YESTERDAY_KEY, { rainfall: 4, temperature: 24, humidity: 55 }),
    );
    setRangeWeather(
      range,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 24, humidity: 40, windSpeed: 23 }),
    );
    setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.daysSinceLastWater).toBe(1.7);
    expect(insight.thresholdDays).toBe(1.5);
    expect(insight.needsWater).toBe(false);
    expect(insight.score).toBe(0.99);
  });

  it('37) reason keeps "yesterday" phrasing for near-two-day values from light-rain delay', async () => {
    const plant = makePlantSummary({ id: 'p-reason-yesterday-near-two-days' });
    const range = makeFullPathRange(6);
    const manualAt = new Date(TODAY_START);
    manualAt.setDate(manualAt.getDate() - 2);
    manualAt.setHours(9, 0, 0, 0);
    addRangeLog(range, toDateKey(addDays(TODAY_START, -2)), makeLog(manualAt, 'watering'));
    setRangeWeather(
      range,
      YESTERDAY_KEY,
      makeWeatherEntry(YESTERDAY_KEY, { rainfall: 4, temperature: 24, humidity: 55 }),
    );
    setRangeWeather(
      range,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 24, humidity: 55 }),
    );
    setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.daysSinceLastWater).toBe(1.7);
    expect(insight.reason).toContain('Watered yesterday');
    expect(insight.reason).not.toContain('2 days ago');
  });

  it('38) refresh path merges parsed dates that were not present in original range', async () => {
    const plant = makePlantSummary({ id: 'p-refresh-extra-date' });
    const range = makeFullPathRange(6);
    setRangeWeather(range, TOMORROW_KEY, null);
    fetchRangeMock.mockResolvedValue(range);

    const extraDateKey = toDateKey(addDays(TODAY_START, 3));
    parseWeatherDataMock.mockReturnValue({
      [extraDateKey]: makeWeatherEntry(extraDateKey, { temperature: 22, rainfall: 0 }),
    } as any);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight).toBeDefined();
    expect(fetchWeatherMock).toHaveBeenCalledTimes(1);
    expect(updateWeatherCacheMock).toHaveBeenCalledTimes(1);
  });

  it('39) outer evaluation catch logs and skips plant when evaluation throws unexpectedly', async () => {
    const badPlant = makePlantSummary({ id: 'p-outer-catch-bad' });
    const goodPlant = makePlantSummary({ id: 'p-outer-catch-good' });

    fetchRangeMock.mockImplementation(async (plantId) => {
      if (plantId === badPlant.id) return undefined as any;
      return makeFullPathRange(6);
    });

    const result = await evaluateWateringInsights([badPlant, goodPlant]);

    expect(result).toHaveLength(1);
    expect(result[0].plantId).toBe(goodPlant.id);
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Failed to evaluate watering insight for plant',
      expect.objectContaining({ plantId: badPlant.id, error: expect.anything() }),
    );
  });

  it('40) watering log without timestamp.toDate falls back to day key for last manual water', async () => {
    const plant = makePlantSummary({ id: 'p-log-fallback-timestamp' });
    const range = makeFullPathRange(6);
    addRangeLog(range, YESTERDAY_KEY, {
      type: 'watering',
      timestamp: {} as any,
      updatedBy: 'demoUser',
    } as any);
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.lastWaterSource).toBe('manual');
    expect(insight.daysSinceLastWater).toBe(1);
  });

  it('41) invalid log timestamp falls back to lookback+1 days without crashing', async () => {
    const plant = makePlantSummary({ id: 'p-invalid-log-date' });
    const range = makeFullPathRange(6);
    addRangeLog(range, YESTERDAY_KEY, {
      type: 'watering',
      timestamp: { toDate: () => new Date(Number.NaN) },
      updatedBy: 'demoUser',
    } as any);
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.daysSinceLastWater).toBe(7);
  });

  it('42) gallon pot size is parsed and mid-sized pots apply no extra modifier', async () => {
    const gallonPlant = makePlantSummary({ id: 'p-pot-gallon', potSize: '5 gallons' });
    const mediumLiterPlant = makePlantSummary({ id: 'p-pot-medium-liter', potSize: '18L' });

    const gallonRange = makeFullPathRange(6);
    setRangeWeather(
      gallonRange,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 31, humidity: 50 }),
    );
    setRangeWeather(gallonRange, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(gallonRange);
    const [gallonInsight] = await evaluateWateringInsights([gallonPlant]);

    const mediumRange = makeFullPathRange(6);
    setRangeWeather(
      mediumRange,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 31, humidity: 50 }),
    );
    setRangeWeather(mediumRange, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(mediumRange);
    const [mediumInsight] = await evaluateWateringInsights([mediumLiterPlant]);

    expect(gallonInsight.thresholdDays).toBe(1.5);
    expect(mediumInsight.thresholdDays).toBe(1.5);
  });

  it('43) partial shade applies a mild threshold increase', async () => {
    const partialShadePlant = makePlantSummary({
      id: 'p-partial-shade',
      sunlightExposure: 'partial shade',
    });
    const neutralPlant = makePlantSummary({
      id: 'p-neutral-sun',
      sunlightExposure: undefined,
    } as any);

    const partialShadeRange = makeFullPathRange(6);
    setRangeWeather(
      partialShadeRange,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 24, humidity: 55 }),
    );
    setRangeWeather(partialShadeRange, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(partialShadeRange);
    const [partialShadeInsight] = await evaluateWateringInsights([partialShadePlant]);

    const neutralRange = makeFullPathRange(6);
    setRangeWeather(
      neutralRange,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 24, humidity: 55 }),
    );
    setRangeWeather(neutralRange, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(neutralRange);
    const [neutralInsight] = await evaluateWateringInsights([neutralPlant]);

    expect(partialShadeInsight.thresholdDays).toBe(2.1);
    expect(neutralInsight.thresholdDays).toBe(2);
  });

  it('44) unknown sunlight descriptors currently apply no threshold modifier', async () => {
    const unknownSunPlant = makePlantSummary({
      id: 'p-unknown-sun',
      sunlightExposure: 'dappled canopy',
    });
    const neutralPlant = makePlantSummary({
      id: 'p-neutral-sun-2',
      sunlightExposure: undefined,
    } as any);

    const unknownRange = makeFullPathRange(6);
    setRangeWeather(
      unknownRange,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 24, humidity: 55 }),
    );
    setRangeWeather(unknownRange, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(unknownRange);
    const [unknownInsight] = await evaluateWateringInsights([unknownSunPlant]);

    const neutralRange = makeFullPathRange(6);
    setRangeWeather(
      neutralRange,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 24, humidity: 55 }),
    );
    setRangeWeather(neutralRange, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(neutralRange);
    const [neutralInsight] = await evaluateWateringInsights([neutralPlant]);

    expect(unknownInsight.thresholdDays).toBe(2);
    expect(unknownInsight.thresholdDays).toBe(neutralInsight.thresholdDays);
  });

  it('45) Plan B with missing humidity keeps mildew at low via defensive fallback', async () => {
    const plant = makePlantSummary({ id: 'p-planb-missing-humidity' });
    const range = makePlanBRange(6);
    setRangeWeather(
      range,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { humidity: undefined as any, temperature: 24, rainfall: 0 }),
    );
    setRangeWeather(range, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.mildewRiskLevel).toBe('low');
    expect(insight.mildewShouldWarn).toBe(false);
  });

  it('46) pot size without unit defaults to liters parsing', async () => {
    const noUnitPlant = makePlantSummary({ id: 'p-pot-no-unit', potSize: '12' });
    const literPlant = makePlantSummary({ id: 'p-pot-12l', potSize: '12L' });

    const noUnitRange = makeFullPathRange(6);
    setRangeWeather(
      noUnitRange,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 31, humidity: 50 }),
    );
    setRangeWeather(noUnitRange, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(noUnitRange);
    const [noUnitInsight] = await evaluateWateringInsights([noUnitPlant]);

    const literRange = makeFullPathRange(6);
    setRangeWeather(
      literRange,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 31, humidity: 50 }),
    );
    setRangeWeather(literRange, TOMORROW_KEY, makeWeatherEntry(TOMORROW_KEY, { rainfall: 0 }));
    fetchRangeMock.mockResolvedValueOnce(literRange);
    const [literInsight] = await evaluateWateringInsights([literPlant]);

    expect(noUnitInsight.thresholdDays).toBe(1.5);
    expect(noUnitInsight.thresholdDays).toBe(literInsight.thresholdDays);
  });

  it('47) low-confidence forecast rain tomorrow does not suppress watering for overdue plants', async () => {
    const plant = makePlantSummary({ id: 'p-low-confidence-tomorrow-rain' });
    const range = makeFullPathRange(6);

    const manualAt = new Date(TODAY_START);
    manualAt.setDate(manualAt.getDate() - 3);
    manualAt.setHours(10, 0, 0, 0);
    addRangeLog(range, toDateKey(addDays(TODAY_START, -3)), makeLog(manualAt, 'watering'));

    setRangeWeather(
      range,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 33, humidity: 38 }),
    );
    setRangeWeather(
      range,
      TOMORROW_KEY,
      makeWeatherEntry(TOMORROW_KEY, { rainfall: 10, forecasted: true, pop: 0.2 }),
    );
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.needsWater).toBe(true);
    expect(insight.reason).toContain('forecast high');
  });

  it('48) Plan B does not suppress watering from low-confidence forecast rain tomorrow', async () => {
    const plant = makePlantSummary({ id: 'p-planb-low-confidence-tomorrow-rain' });
    const range = makePlanBRange(6);
    setRangeWeather(
      range,
      TODAY_KEY,
      makeWeatherEntry(TODAY_KEY, { rainfall: 0, temperature: 31, humidity: 45 }),
    );
    setRangeWeather(
      range,
      TOMORROW_KEY,
      makeWeatherEntry(TOMORROW_KEY, { rainfall: 10, forecasted: true, pop: 0.2 }),
    );
    fetchRangeMock.mockResolvedValue(range);

    const [insight] = await evaluateWateringInsights([plant]);

    expect(insight.needsWater).toBe(true);
    expect(insight.reason).toContain('low-confidence');
  });
});

it('does not start any plant requests after its screen cancels the run', async () => {
  const controller = new AbortController(); controller.abort();
  expect(await evaluateWateringInsights([makePlantSummary({ id: 'cancelled' })], undefined, controller.signal)).toEqual([]);
  expect(fetchRangeMock).not.toHaveBeenCalled();
});

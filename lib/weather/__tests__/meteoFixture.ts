import type { OpenMeteoPayload } from '../openMeteo';
export const meteoFixture = jest.requireActual('../../../scripts/fixtures/open-meteo.cjs') as (now?: number) => OpenMeteoPayload;

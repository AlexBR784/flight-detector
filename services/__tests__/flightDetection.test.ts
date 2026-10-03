import { angleBetween, findAircraftInView, getNearbyAircraft, smoothDirection, type AircraftState, type DetectedAircraft } from '../flightDetection';

const now = 1_800_000_000_000;
const observer = { latitude: 0, longitude: 0, altitude: 0 };
function state(id: string, lat: number, lon: number, altitude: number | null = 1000): AircraftState {
  return [id, ' TEST123 ', 'Spain', now / 1000, now / 1000, lon, lat, altitude, false, null, null, null, null, altitude];
}

test('matches the pointing ray and rejects an aircraft behind the observer', () => {
  const aircraft = getNearbyAircraft([state('north', 0.1, 0), state('south', -0.1, 0)], observer, now);
  const target = aircraft.find((plane) => plane.icao24 === 'north')!;
  const matches = findAircraftInView(aircraft, { headingDegrees: 0, elevationDegrees: target.elevationDegrees!, timestamp: now });
  expect(matches.map((plane) => plane.icao24)).toEqual(['north']);
  expect(matches[0].angularDeviation).toBeCloseTo(0, 5);
});

test('rejects stale, grounded and invalid aircraft but keeps unknown altitude in nearby list', () => {
  const stale = state('stale', 0.1, 0); stale[3] = now / 1000 - 121;
  const lost = state('lost', 0.1, 0); lost[4] = now / 1000 - 121;
  const grounded = state('ground', 0.1, 0); grounded[8] = true;
  const missing = state('missing', 0.1, 0); missing[5] = null;
  const invalid = state('invalid', NaN, 0);
  const result = getNearbyAircraft([stale, lost, grounded, missing, invalid, state('unknown', 0.1, 0, null)], observer, now);
  expect(result.map((plane) => plane.icao24)).toEqual(['unknown']);
  expect(result[0].altitude).toBeNull();
  expect(findAircraftInView(result, { headingDegrees: 0, elevationDegrees: 0, timestamp: now })).toEqual([]);
});

test('ranks by angular deviation before distance and returns at most three', () => {
  const base = getNearbyAircraft([state('base', 0.1, 0)], observer, now)[0];
  const aircraft: DetectedAircraft[] = [5, 0, 15, 10, 25].map((bearing, index) => ({ ...base, icao24: String(index), bearingDegrees: bearing, elevationDegrees: 0, distanceMeters: 5000 - index * 1000 }));
  expect(findAircraftInView(aircraft, { headingDegrees: 0, elevationDegrees: 0, timestamp: now }).map((plane) => plane.icao24)).toEqual(['1', '0', '3']);
});

test('heading wraps around north and smoothing does not turn through south', () => {
  const base = getNearbyAircraft([state('near', 0.1, 0)], observer, now)[0];
  const result = findAircraftInView([{ ...base, bearingDegrees: 1, elevationDegrees: 0 }], { headingDegrees: 359, elevationDegrees: 0, timestamp: now });
  expect(result[0].angularDeviation).toBeCloseTo(2);
  const smooth = smoothDirection({ headingDegrees: 359, elevationDegrees: 0, timestamp: now }, { headingDegrees: 1, elevationDegrees: 0, timestamp: now + 200 });
  expect(smooth.headingDegrees).toBeCloseTo(359.7);
  expect(angleBetween([0, 0, 0], [1, 0, 0])).toBe(180);
  expect(angleBetween([NaN, 0, 0], [1, 0, 0])).toBe(180);
});

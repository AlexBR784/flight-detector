import { buildAdsbUrl, parseAdsbSnapshot } from '../adsb';
import { getNearbyAircraft } from '../flightDetection';

const now = 1_800_000_000_000;
const position = { latitude: 40.4, longitude: -3.7, altitude: 600 };
const plane = { hex: 'abc123', flight: ' TEST123 ', lat: 40.5, lon: -3.7, alt_baro: 10000, alt_geom: 11000, seen: 1, seen_pos: 2 };
test('converts feet to metres and preserves age, callsign and source without inventing country', () => {
  const snapshot = parseAdsbSnapshot({ now, ac: [plane] }, position);
  const aircraft = getNearbyAircraft(snapshot.states, position, now);
  expect(snapshot.source).toBe('adsb-lol');
  expect(snapshot.time).toBe(now / 1000);
  expect(aircraft[0].altitude).toBeCloseTo(3352.8);
  expect(aircraft[0].callsign).toBe('TEST123');
  expect(aircraft[0].country).toBe('País no disponible');
});
test('filters area and invalid identifiers and lets the domain reject stale and grounded data', () => {
  const snapshot = parseAdsbSnapshot({ now: now / 1000, ac: [plane, { ...plane, hex: 'abc124', seen_pos: 121 }, { ...plane, hex: 'abc125', alt_baro: 'ground' }, { ...plane, hex: '~abc126' }, { ...plane, hex: 'abc127', lon: -4.2 }] }, position);
  expect(snapshot.states).toHaveLength(3);
  expect(getNearbyAircraft(snapshot.states, position, now).map((value) => value.icao24)).toEqual(['abc123']);
  expect(() => parseAdsbSnapshot({ ac: [] }, position)).toThrow();
  expect(() => buildAdsbUrl({ latitude: 91, longitude: 0 })).toThrow();
});

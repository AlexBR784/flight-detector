import type { Position, AircraftState } from './flightDetection';
import { buildOpenSkyUrls, type FlightSnapshot } from './opensky';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function buildAdsbUrl(position: Pick<Position, 'latitude' | 'longitude'>) {
  buildOpenSkyUrls(position); // Same coordinate validation and fixed search area as OpenSky.
  return `https://api.adsb.lol/v2/point/${position.latitude}/${position.longitude}/26`;
}

export function parseAdsbSnapshot(data: unknown, position: Pick<Position, 'latitude' | 'longitude'>): FlightSnapshot {
  if (!data || typeof data !== 'object') throw new Error('Respuesta ADSB no válida.');
  const payload = data as Record<string, unknown>;
  if (!finite(payload.now) || !Array.isArray(payload.ac)) throw new Error('Respuesta ADSB no válida.');
  const time = payload.now > 1e12 ? payload.now / 1000 : payload.now;
  const states: AircraftState[] = [];
  for (const raw of payload.ac) {
    if (!raw || typeof raw !== 'object') continue;
    const plane = raw as Record<string, unknown>;
    if (typeof plane.hex !== 'string' || !/^[0-9a-f]{6}$/i.test(plane.hex) || !finite(plane.lat) || !finite(plane.lon)) continue;
    const longitudeDelta = Math.abs(((plane.lon - position.longitude + 540) % 360) - 180);
    if (Math.abs(plane.lat - position.latitude) > 0.3 || longitudeDelta > 0.3) continue;
    const altitude = finite(plane.alt_geom) ? plane.alt_geom * 0.3048 : null;
    const barometric = finite(plane.alt_baro) ? plane.alt_baro * 0.3048 : null;
    states.push([
      plane.hex, typeof plane.flight === 'string' ? plane.flight : null, 'País no disponible',
      finite(plane.seen_pos) ? time - plane.seen_pos : null, finite(plane.seen) ? time - plane.seen : null,
      plane.lon, plane.lat, barometric, plane.alt_baro === 'ground', null, null, null, null, altitude,
    ]);
  }
  return { time, states, source: 'adsb-lol' };
}

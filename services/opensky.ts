import type { AircraftState, Position } from './flightDetection';

export type FlightSource = 'opensky' | 'adsb-lol';
export type FlightSnapshot = { time: number; states: AircraftState[]; source?: FlightSource };

export function buildOpenSkyUrls(position: Pick<Position, 'latitude' | 'longitude'>) {
  const { latitude, longitude } = position;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error('Coordenadas no válidas.');
  }
  const west = longitude - 0.3, east = longitude + 0.3;
  const ranges = west < -180 ? [[west + 360, 180], [-180, east]]
    : east > 180 ? [[west, 180], [-180, east - 360]] : [[west, east]];
  return ranges.map(([lomin, lomax]) => {
    const params = new URLSearchParams({
      lamin: String(Math.max(-90, latitude - 0.3)), lamax: String(Math.min(90, latitude + 0.3)),
      lomin: String(lomin), lomax: String(lomax),
    });
    return 'https://opensky-network.org/api/states/all?' + params;
  });
}

export function parseFlightSnapshot(data: unknown): FlightSnapshot {
  if (!data || typeof data !== 'object') throw new Error('Respuesta de vuelos no válida.');
  const value = data as Record<string, unknown>;
  if (typeof value.time !== 'number' || !Number.isFinite(value.time) || (value.states !== null && !Array.isArray(value.states))) {
    throw new Error('Respuesta de vuelos no válida.');
  }
  return { time: value.time, states: (value.states ?? []) as AircraftState[],
    ...(value.source === 'adsb-lol' || value.source === 'opensky' ? { source: value.source } : {}) };
}

export function combineSnapshots(snapshots: FlightSnapshot[]): FlightSnapshot {
  const states = new Map<string, AircraftState>();
  for (const snapshot of snapshots) for (const state of snapshot.states) {
    if (Array.isArray(state) && typeof state[0] === 'string') states.set(state[0], state);
  }
  return { time: Math.min(...snapshots.map((snapshot) => snapshot.time)), states: [...states.values()],
    ...(snapshots[0]?.source ? { source: snapshots[0].source } : {}) };
}

export function retryDelay(header: string | null, now = Date.now()) {
  if (!header) return 60_000;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(1000, seconds * 1000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(1000, date - now) : 60_000;
}

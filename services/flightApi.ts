import { Platform } from 'react-native';
import type { Position } from './flightDetection';
import { buildOpenSkyUrls, combineSnapshots, parseFlightSnapshot, retryDelay } from './opensky';

export class FlightApiError extends Error {
  constructor(message: string, public retryAfterMs = 30_000) { super(message); }
}

export async function fetchNearbyAircraft(position: Position, signal: AbortSignal) {
  const urls = Platform.OS === 'web'
    ? ['/api/flights?' + new URLSearchParams({ latitude: String(position.latitude), longitude: String(position.longitude) })]
    : buildOpenSkyUrls(position);
  const snapshots = await Promise.all(urls.map(async (url) => {
    const response = await fetch(url, { signal });
    if (response.status === 429) throw new FlightApiError('Se ha alcanzado el límite del servicio de vuelos. Esperaremos antes de volver a consultar.', retryDelay(response.headers.get('Retry-After') ?? response.headers.get('X-Rate-Limit-Retry-After-Seconds')));
    if (!response.ok) throw new FlightApiError('El servicio de vuelos no está disponible. Volveremos a intentarlo.');
    return parseFlightSnapshot(await response.json());
  }));
  return combineSnapshots(snapshots);
}

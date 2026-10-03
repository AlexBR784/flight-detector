/** @jest-environment node */
import { handleFlightsRequest } from '../flightsProxy';
import { buildOpenSkyUrls, retryDelay } from '../../services/opensky';

const request = (query = 'latitude=40&longitude=-3', method = 'GET') => new Request(`https://example.com/api/flights?${query}`, { method });
const fetcher = () => jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();

test('rejects unsupported methods and invalid coordinates without contacting upstream', async () => {
  const mock = fetcher();
  expect((await handleFlightsRequest(request('', 'POST'), mock)).status).toBe(405);
  for (const query of ['', 'latitude=91&longitude=0', 'latitude=0&longitude=181', 'latitude=NaN&longitude=0', 'latitude=&longitude=0']) {
    expect((await handleFlightsRequest(request(query), mock)).status).toBe(400);
  }
  expect(mock).not.toHaveBeenCalled();
});
test('uses a fixed OpenSky bounding box and caches only successful responses', async () => {
  const mock = fetcher().mockResolvedValue(new Response(JSON.stringify({ time: 1, states: null })));
  const response = await handleFlightsRequest(request('latitude=40&longitude=-3&url=https://evil.test'), mock);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ time: 1, states: [] });
  expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=15');
  const url = new URL(mock.mock.calls[0][0] as string);
  expect(url.hostname).toBe('opensky-network.org');
  expect(url.searchParams.get('lamin')).toBe('39.7');
  expect(url.searchParams.get('lamax')).toBe('40.3');
});
test('passes retry delay on rate limiting and does not cache the error', async () => {
  const mock = fetcher().mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '90' } }));
  const response = await handleFlightsRequest(request(), mock);
  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('90');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const now = Date.parse('2026-01-01T00:00:00Z');
  expect(retryDelay('Thu, 01 Jan 2026 00:02:00 GMT', now)).toBe(120000);
});
test('returns controlled errors for timeouts, bad JSON and upstream failure', async () => {
  const timeout = new Error('Timeout'); timeout.name = 'TimeoutError';
  expect((await handleFlightsRequest(request(), fetcher().mockRejectedValue(timeout))).status).toBe(504);
  expect((await handleFlightsRequest(request(), fetcher().mockResolvedValue(new Response('invalid')))).status).toBe(502);
  expect((await handleFlightsRequest(request(), fetcher().mockResolvedValue(new Response('', { status: 503 })))).status).toBe(502);
});
test('splits bounding boxes at the antimeridian and deduplicates aircraft', async () => {
  expect(buildOpenSkyUrls({ latitude: 0, longitude: 179.9 })).toHaveLength(2);
  expect(buildOpenSkyUrls({ latitude: 89.9, longitude: 0 })[0]).toContain('lamax=90');
  const mock = fetcher().mockResolvedValue(new Response(JSON.stringify({ time: 1, states: [['duplicate']] })));
  // Each upstream call needs its own readable response body.
  mock.mockImplementation(async () => new Response(JSON.stringify({ time: 1, states: [['duplicate']] })));
  const result = await handleFlightsRequest(request('latitude=0&longitude=179.9'), mock);
  expect(mock).toHaveBeenCalledTimes(2);
  expect((await result.json()).states).toEqual([['duplicate']]);
});

test('uses the fixed public backup after OpenSky failure and identifies its source', async () => {
  const mock = fetcher().mockRejectedValueOnce(new Error('OpenSky unreachable'))
    .mockResolvedValueOnce(new Response(JSON.stringify({ now: 1800000000, ac: [] })));
  const response = await handleFlightsRequest(request(), mock);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ time: 1800000000, states: [], source: 'adsb-lol' });
  expect(mock.mock.calls[1][0]).toBe('https://api.adsb.lol/v2/point/40/-3/26');
});

test('respects the OpenSky quota header and does not switch provider on rate limiting', async () => {
  const mock = fetcher().mockResolvedValue(new Response('', { status: 429, headers: { 'X-Rate-Limit-Retry-After-Seconds': '3600' } }));
  const response = await handleFlightsRequest(request(), mock);
  expect(response.headers.get('Retry-After')).toBe('3600');
  expect(mock).toHaveBeenCalledTimes(1);
});

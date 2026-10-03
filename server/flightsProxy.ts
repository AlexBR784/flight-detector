import { buildOpenSkyUrls, combineSnapshots, parseFlightSnapshot, retryDelay } from '../services/opensky';
import { buildAdsbUrl, parseAdsbSnapshot } from '../services/adsb';

function json(data: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
}

export async function handleFlightsRequest(request: Request, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Método no permitido.' }, 405, { Allow: 'GET' });
  const params = new URL(request.url).searchParams;
  const lat = params.get('latitude'), lon = params.get('longitude');
  if (!lat?.trim() || !lon?.trim()) return json({ error: 'Faltan coordenadas.' }, 400);
  let urls: string[];
  const position = { latitude: Number(lat), longitude: Number(lon) };
  try { urls = buildOpenSkyUrls(position); }
  catch { return json({ error: 'Coordenadas no válidas.' }, 400); }
  const controller = new AbortController();
  const openSkyController = new AbortController();
  const cancelOpenSky = () => openSkyController.abort();
  controller.signal.addEventListener('abort', cancelOpenSky);
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  const openSkyTimeout = setTimeout(cancelOpenSky, 4_000);
  const limited = (response: Response) => json({ error: 'Límite de consultas alcanzado.' }, 429, {
    'Retry-After': String(Math.ceil(retryDelay(response.headers.get('Retry-After') ?? response.headers.get('X-Rate-Limit-Retry-After-Seconds')) / 1000)),
  });
  try {
    try {
      const snapshots = [];
      for (const url of urls) {
        const response = await fetcher(url, { signal: openSkyController.signal });
        if (response.status === 429) return limited(response);
        if (!response.ok) throw new Error('OpenSky no está disponible.');
        snapshots.push(parseFlightSnapshot(await response.json()));
      }
      return json(combineSnapshots(snapshots), 200, { 'Cache-Control': 'public, s-maxage=15' });
    } catch {
      clearTimeout(openSkyTimeout);
      if (controller.signal.aborted) throw new DOMException('Tiempo agotado.', 'AbortError');
      const response = await fetcher(buildAdsbUrl(position), { signal: controller.signal });
      if (response.status === 429) return limited(response);
      if (!response.ok) throw new Error('El servicio de respaldo no está disponible.');
      return json(parseAdsbSnapshot(await response.json(), position), 200, { 'Cache-Control': 'public, s-maxage=15' });
    }
  } catch (error) {
    const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    if (process.env.VERCEL) console.warn('Flight request failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'Unknown failure',
    });
    return json({ error: timeout ? 'La consulta tardó demasiado.' : 'No se pudieron consultar los vuelos.' }, timeout ? 504 : 502);
  } finally { clearTimeout(timeoutId); clearTimeout(openSkyTimeout); controller.signal.removeEventListener('abort', cancelOpenSky); }
}

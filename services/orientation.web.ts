import { normalizeHeading, smoothDirection, type PointingDirection, type Position } from './flightDetection';
import { magneticDeclination, webElevation } from './orientationMath';

type SafariOrientation = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
type OrientationConstructor = typeof DeviceOrientationEvent & { requestPermission?: (absolute?: boolean) => Promise<string> };

// Called directly from the button handler, before any await, for Safari's gesture requirement.
export async function requestOrientationPermission() {
  if (typeof window === 'undefined' || !window.isSecureContext || typeof DeviceOrientationEvent === 'undefined') return false;
  try {
    const request = (DeviceOrientationEvent as OrientationConstructor).requestPermission;
    return request ? await request.call(DeviceOrientationEvent, true) === 'granted' : true;
  } catch { return false; }
}

export function subscribeOrientation(position: Position, reading: (value: PointingDirection | null) => void, status: (message: string | null) => void) {
  const declination = magneticDeclination(position);
  let last: PointingDirection | null = null, lastEmission = 0;
  const timer = setTimeout(() => { if (!last) status('Safari no ha enviado datos de brújula. Puedes usar la lista de aviones cercanos.'); }, 5000);
  const listener = (raw: DeviceOrientationEvent) => {
    const event = raw as SafariOrientation;
    if (Date.now() - lastEmission < 200) return;
    lastEmission = Date.now();
    const angle = window.screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0;
    if (angle % 180 !== 0 || window.innerWidth > window.innerHeight) {
      last = null; reading(null); status('Gira el móvil a vertical para apuntar con su borde superior.'); return;
    }
    if (event.beta === null || !Number.isFinite(event.beta) || Math.abs(event.beta) > 90) {
      last = null; reading(null); status('Mantén la pantalla hacia ti y levanta el borde superior hacia el avión.'); return;
    }
    let heading: number | null = null;
    if (declination !== null && typeof event.webkitCompassHeading === 'number' && Number.isFinite(event.webkitCompassHeading) && event.webkitCompassHeading >= 0 && event.webkitCompassAccuracy !== -1) {
      heading = event.webkitCompassHeading + declination;
    } else if (event.absolute && event.alpha !== null && event.gamma !== null) {
      const alpha = event.alpha * Math.PI / 180, beta = event.beta * Math.PI / 180;
      // Top-edge (+Y) vector in the Earth frame; relative alpha is never treated as north.
      heading = Math.atan2(-Math.sin(alpha) * Math.cos(beta), Math.cos(alpha) * Math.cos(beta)) * 180 / Math.PI;
    }
    if (heading === null || !Number.isFinite(heading)) {
      last = null; reading(null); status('No hay rumbo absoluto disponible. Mostramos los aviones cercanos.'); return;
    }
    last = smoothDirection(last, { headingDegrees: normalizeHeading(heading), elevationDegrees: webElevation(event.beta), timestamp: Date.now() });
    status(null); reading(last);
  };
  window.addEventListener('deviceorientation', listener);
  window.addEventListener('deviceorientationabsolute', listener);
  return () => { clearTimeout(timer); window.removeEventListener('deviceorientation', listener); window.removeEventListener('deviceorientationabsolute', listener); };
}

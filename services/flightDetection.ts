export type AircraftState = (string | number | boolean | number[] | null)[];
export type Position = { latitude: number; longitude: number; altitude: number };
export type PointingDirection = { headingDegrees: number; elevationDegrees: number; timestamp: number };
export type DetectedAircraft = {
  icao24: string; callsign: string | null; country: string; altitude: number | null;
  distanceMeters: number; bearingDegrees: number; elevationDegrees: number | null; angularDeviation: number | null;
};

const radians = (degrees: number) => degrees * Math.PI / 180;
const degrees = (value: number) => value * 180 / Math.PI;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const normalizeHeading = (heading: number) => ((heading % 360) + 360) % 360;

function earthCentered(position: Position) {
  const lat = radians(position.latitude), lon = radians(position.longitude);
  const radius = 6_371_000 + position.altitude;
  return [radius * Math.cos(lat) * Math.cos(lon), radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat)];
}

function localDirection(observer: Position, target: Position) {
  const a = earthCentered(observer), b = earthCentered(target);
  const [dx, dy, dz] = b.map((value, index) => value - a[index]);
  const lat = radians(observer.latitude), lon = radians(observer.longitude);
  return [
    -Math.sin(lon) * dx + Math.cos(lon) * dy,
    -Math.sin(lat) * Math.cos(lon) * dx - Math.sin(lat) * Math.sin(lon) * dy + Math.cos(lat) * dz,
    Math.cos(lat) * Math.cos(lon) * dx + Math.cos(lat) * Math.sin(lon) * dy + Math.sin(lat) * dz,
  ];
}

export function pointingVector(direction: PointingDirection) {
  const heading = radians(direction.headingDegrees), elevation = radians(direction.elevationDegrees);
  return [Math.sin(heading) * Math.cos(elevation), Math.cos(heading) * Math.cos(elevation), Math.sin(elevation)];
}

export function angleBetween(a: number[], b: number[]) {
  const norm = Math.hypot(...a) * Math.hypot(...b);
  if (!finite(norm) || norm === 0) return 180;
  const cosine = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / norm;
  return degrees(Math.acos(Math.max(-1, Math.min(1, cosine))));
}

export function smoothDirection(previous: PointingDirection | null, next: PointingDirection): PointingDirection {
  if (!previous || next.timestamp - previous.timestamp > 5000) return next;
  const weight = 0.35;
  const delta = ((next.headingDegrees - previous.headingDegrees + 540) % 360) - 180;
  return {
    headingDegrees: normalizeHeading(previous.headingDegrees + delta * weight),
    elevationDegrees: previous.elevationDegrees + (next.elevationDegrees - previous.elevationDegrees) * weight,
    timestamp: next.timestamp,
  };
}

export function getNearbyAircraft(states: AircraftState[], observer: Position, now = Date.now()): DetectedAircraft[] {
  const seconds = now / 1000;
  const aircraft: DetectedAircraft[] = [];
  for (const state of states) {
    if (!Array.isArray(state)) continue;
    const [icao24, callsign, country, positionTime, lastContact, longitude, latitude, barometricAltitude, onGround] = state;
    if (typeof icao24 !== 'string' || onGround === true) continue;
    if (!finite(latitude) || !finite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    if (!finite(positionTime) || !finite(lastContact) || seconds - positionTime > 120 || seconds - lastContact > 120) continue;
    if (positionTime > seconds + 30 || lastContact > seconds + 30) continue;
    const altitude = finite(state[13]) ? state[13] : finite(barometricAltitude) ? barometricAltitude : null;
    const direction = localDirection(observer, { latitude, longitude, altitude: altitude ?? observer.altitude });
    const distance = Math.hypot(...direction);
    if (!finite(distance) || distance === 0) continue;
    aircraft.push({
      icao24, callsign: typeof callsign === 'string' && callsign.trim() ? callsign.trim() : null,
      country: typeof country === 'string' ? country : 'Desconocido', altitude, distanceMeters: distance,
      bearingDegrees: normalizeHeading(degrees(Math.atan2(direction[0], direction[1]))),
      elevationDegrees: altitude === null ? null : degrees(Math.atan2(direction[2], Math.hypot(direction[0], direction[1]))),
      angularDeviation: null,
    });
  }
  return aircraft.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export function findAircraftInView(aircraft: DetectedAircraft[], direction: PointingDirection, maximumAngle = 20) {
  if (!finite(direction.headingDegrees) || !finite(direction.elevationDegrees)) return [];
  const view = pointingVector(direction);
  return aircraft.filter((plane) => plane.elevationDegrees !== null).map((plane) => ({
    ...plane,
    angularDeviation: angleBetween(view, pointingVector({
      headingDegrees: plane.bearingDegrees, elevationDegrees: plane.elevationDegrees!, timestamp: direction.timestamp,
    })),
  })).filter((plane) => plane.angularDeviation <= maximumAngle)
    .sort((a, b) => a.angularDeviation - b.angularDeviation || a.distanceMeters - b.distanceMeters).slice(0, 3);
}

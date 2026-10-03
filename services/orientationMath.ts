import { model } from 'geomagnetism';
import type { Position } from './flightDetection';

export function magneticDeclination(position: Position) {
  try {
    const declination = model(new Date()).point([position.latitude, position.longitude, position.altitude / 1000]).decl;
    return Number.isFinite(declination) ? declination : null;
  } catch { return null; }
}

export function nativeElevation(x: number, y: number, z: number, ios: boolean) {
  const norm = Math.hypot(x, y, z);
  return norm > 0 ? Math.asin(Math.max(-1, Math.min(1, (ios ? -y : y) / norm))) * 180 / Math.PI : null;
}

export function webElevation(beta: number) {
  return Math.asin(Math.sin(beta * Math.PI / 180)) * 180 / Math.PI;
}

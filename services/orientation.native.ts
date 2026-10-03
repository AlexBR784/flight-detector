import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { Accelerometer, Magnetometer } from 'expo-sensors';
import { normalizeHeading, smoothDirection, type PointingDirection, type Position } from './flightDetection';
import { magneticDeclination, nativeElevation } from './orientationMath';

export async function requestOrientationPermission() {
  try { return (await Accelerometer.requestPermissionsAsync()).granted; } catch { return false; }
}

export function subscribeOrientation(position: Position, reading: (value: PointingDirection | null) => void, status: (message: string | null) => void) {
  let disposed = false, heading: number | null = null, elevation: number | null = null;
  let headingTime = 0, last: PointingDirection | null = null;
  let acceleration: ReturnType<typeof Accelerometer.addListener> | undefined;
  let compass: Location.LocationSubscription | undefined;
  const declination = magneticDeclination(position);
  const publish = () => {
    if (disposed || heading === null || elevation === null || Date.now() - headingTime > 5000) return;
    last = smoothDirection(last, { headingDegrees: heading, elevationDegrees: elevation, timestamp: Date.now() });
    status(null); reading(last);
  };
  const timer = setTimeout(() => { if (!disposed && !last) status('Brújula no disponible. Puedes consultar los aviones cercanos.'); }, 5000);
  void (async () => {
    try {
      const [hasAcceleration, hasCompass] = await Promise.all([Accelerometer.isAvailableAsync(), Magnetometer.isAvailableAsync()]);
      if (disposed) return;
      if (!hasAcceleration || !hasCompass) { status('Este dispositivo no tiene los sensores necesarios. Mostramos los aviones cercanos.'); return; }
      Accelerometer.setUpdateInterval(200);
      acceleration = Accelerometer.addListener(({ x, y, z }) => {
        elevation = nativeElevation(x, y, z, Platform.OS === 'ios'); publish();
      });
      const subscription = await Location.watchHeadingAsync((value) => {
        if (disposed) return;
        if (value.accuracy < 2) {
          heading = null; last = null; reading(null); status('Calibra la brújula moviendo el móvil en forma de ocho.'); return;
        }
        const trueHeading = value.trueHeading >= 0 ? value.trueHeading
          : declination !== null && value.magHeading >= 0 ? value.magHeading + declination : null;
        if (trueHeading === null || !Number.isFinite(trueHeading)) {
          heading = null; last = null; reading(null); status('No se pudo determinar el norte verdadero. Mostramos los aviones cercanos.'); return;
        }
        heading = normalizeHeading(trueHeading);
        headingTime = Date.now(); publish();
      });
      if (disposed) subscription.remove(); else compass = subscription;
    } catch { if (!disposed) { reading(null); status('No se pudo iniciar la brújula. Mostramos los aviones cercanos.'); } }
  })();
  return () => { disposed = true; clearTimeout(timer); acceleration?.remove(); compass?.remove(); };
}

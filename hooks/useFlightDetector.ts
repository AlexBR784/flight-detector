import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';
import * as Location from 'expo-location';
import { fetchNearbyAircraft, FlightApiError } from '@/services/flightApi';
import { findAircraftInView, getNearbyAircraft, type AircraftState, type PointingDirection, type Position } from '@/services/flightDetection';
import { requestOrientationPermission, subscribeOrientation } from '@/services/orientation';
import type { FlightSource } from '@/services/opensky';

function positionOf(location: Location.LocationObject): Position {
  return { latitude: location.coords.latitude, longitude: location.coords.longitude, altitude: location.coords.altitude ?? 0 };
}

export function useFlightDetector() {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const [active, setActive] = useState(false), [starting, setStarting] = useState(false);
  const [sensorsAllowed, setSensorsAllowed] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [direction, setDirection] = useState<PointingDirection | null>(null);
  const [sensorMessage, setSensorMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [states, setStates] = useState<AircraftState[]>([]);
  const [source, setSource] = useState<FlightSource>('opensky');
  const [fetching, setFetching] = useState(false), [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now), [refreshRevision, setRefreshRevision] = useState(0);
  const generation = useRef(0), positionRef = useRef<Position | null>(null), nextRequestAt = useRef(0);
  const running = active && focused && foreground;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => { subscription.remove(); generation.current++; };
  }, []);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const start = useCallback(async () => {
    // Keep this first: Safari requires the permission request within the original tap.
    const orientationPermission = requestOrientationPermission();
    const attempt = ++generation.current;
    setStarting(true); setMessage(null); setSensorMessage(null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Permite el acceso a tu ubicación para consultar los vuelos.');
      const location = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('No se pudo obtener tu ubicación. Comprueba el GPS e inténtalo de nuevo.')), 15_000); }),
      ]);
      const allowed = await orientationPermission;
      if (attempt !== generation.current) return;
      positionRef.current = positionOf(location); setPosition(positionRef.current);
      setSensorsAllowed(allowed); setDirection(null);
      setSensorMessage(allowed ? 'Esperando a la brújula…' : 'Sin permiso de orientación. Puedes consultar los aviones cercanos.');
      setNow(Date.now()); setActive(true);
    } catch (error) {
      if (attempt === generation.current) setMessage(error instanceof Error ? error.message : 'No se pudo iniciar el detector.');
    } finally { if (timer) clearTimeout(timer); if (attempt === generation.current) setStarting(false); }
  }, []);

  const stop = useCallback(() => { generation.current++; setStarting(false); setActive(false); setDirection(null); }, []);

  useEffect(() => {
    if (!running) return;
    let disposed = false, subscription: Location.LocationSubscription | undefined;
    void Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 10_000 }, (location) => {
      if (!disposed) { positionRef.current = positionOf(location); setPosition(positionRef.current); }
    }).then((value) => { if (disposed) value.remove(); else subscription = value; })
      .catch(() => { if (!disposed) setMessage('No se pudo seguir tu ubicación. Detén el detector y vuelve a activarlo.'); });
    return () => { disposed = true; subscription?.remove(); };
  }, [running]);

  useEffect(() => {
    setDirection(null);
    if (!running || !position || !sensorsAllowed) return;
    setSensorMessage('Esperando a la brújula…');
    return subscribeOrientation(position, setDirection, setSensorMessage);
  }, [running, position, sensorsAllowed]);

  useEffect(() => {
    if (!running) { setFetching(false); return; }
    let disposed = false, controller: AbortController | undefined;
    let schedule: ReturnType<typeof setTimeout> | undefined, timeout: ReturnType<typeof setTimeout> | undefined;
    const request = async () => {
      if (disposed || !positionRef.current) return;
      const delay = nextRequestAt.current - Date.now();
      if (delay > 0) { schedule = setTimeout(request, delay); return; }
      controller = new AbortController();
      timeout = setTimeout(() => controller?.abort(), 10_000);
      setFetching(true);
      let wait = 30_000;
      try {
        const snapshot = await fetchNearbyAircraft(positionRef.current, controller.signal);
        if (!disposed) { setStates(snapshot.states); setSource(snapshot.source ?? 'opensky'); setUpdatedAt(Date.now()); setMessage(null); setNow(Date.now()); }
      } catch (error) {
        if (!disposed) {
          wait = error instanceof FlightApiError ? Math.max(30_000, error.retryAfterMs) : 30_000;
          setMessage(error instanceof FlightApiError ? error.message : 'No se pudieron actualizar los vuelos. Comprueba tu conexión; volveremos a intentarlo.');
        }
      } finally {
        if (timeout) clearTimeout(timeout);
        if (!disposed) { setFetching(false); nextRequestAt.current = Date.now() + wait; schedule = setTimeout(request, wait); }
      }
    };
    void request();
    return () => { disposed = true; controller?.abort(); if (timeout) clearTimeout(timeout); if (schedule) clearTimeout(schedule); };
  }, [running, refreshRevision]);

  const nearby = useMemo(() => position ? getNearbyAircraft(states, position, now) : [], [states, position, now]);
  const liveDirection = running && direction && now - direction.timestamp <= 5000 ? direction : null;
  const candidates = useMemo(() => liveDirection ? findAircraftInView(nearby, liveDirection) : [], [nearby, liveDirection]);
  const refresh = () => { if (!fetching && Date.now() >= nextRequestAt.current) setRefreshRevision((value) => value + 1); };
  return { active, starting, fetching, running, position, direction: liveDirection, nearby, candidates, message, source,
    sensorMessage: running && sensorsAllowed && !liveDirection && !sensorMessage ? 'La brújula no está enviando datos recientes. Mostramos los aviones cercanos.' : sensorMessage,
    updatedAt, canRefresh: !fetching && now >= nextRequestAt.current, start, stop, refresh };
}

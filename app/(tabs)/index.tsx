import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Head from 'expo-router/head';
import { useFlightDetector } from '@/hooks/useFlightDetector';
import type { DetectedAircraft } from '@/services/flightDetection';

const palette = { navy: '#0B1D2C', ink: '#132D40', line: '#2B4254', paper: '#F4F0E6', muted: '#A6B8C5', teal: '#A5E8D0', amber: '#FFD48C' };
const cardinal = (heading: number) => ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(heading / 45) % 8];

function AircraftRow({ plane, rank, aligned }: { plane: DetectedAircraft; rank: number; aligned: boolean }) {
  const [linkError, setLinkError] = useState(false);
  const openFlight = async () => {
    try { await Linking.openURL(`https://www.flightradar24.com/${encodeURIComponent(plane.callsign!)}`); }
    catch { setLinkError(true); }
  };
  return <View style={styles.aircraft}>
    <Text style={styles.rank}>{String(rank).padStart(2, '0')}</Text>
    <View style={styles.aircraftBody}>
      <View style={styles.row}>
        <Text style={styles.callsign}>{plane.callsign ?? plane.icao24.toUpperCase()}</Text>
        <Text style={styles.deviation}>{aligned ? `${plane.angularDeviation?.toFixed(1)}°` : `${(plane.distanceMeters / 1000).toFixed(1)} km`}</Text>
      </View>
      <Text style={styles.country}>{plane.country}</Text>
      <Text style={styles.details}>
        {plane.altitude === null ? 'Altitud no disponible' : `${Math.round(plane.altitude).toLocaleString('es-ES')} m de altitud`}
        {aligned ? `  ·  ${(plane.distanceMeters / 1000).toFixed(1)} km` : `  ·  ${Math.round(plane.bearingDegrees)}° ${cardinal(plane.bearingDegrees)}`}
      </Text>
      {plane.callsign && <Pressable accessibilityRole="link" onPress={openFlight} style={styles.flightLink}>
        <Text style={styles.flightLinkText}>Ver en Flightradar24 ↗</Text>
      </Pressable>}
      {linkError && <Text style={styles.details}>No se pudo abrir el enlace.</Text>}
    </View>
  </View>;
}

export default function DetectorScreen() {
  const detector = useFlightDetector();
  const direction = detector.direction;
  const aligned = direction !== null;
  const heading = direction ? Math.round(direction.headingDegrees) % 360 : null;
  const nearbyFallback = !aligned || detector.candidates.length === 0;
  const planes = nearbyFallback ? detector.nearby.slice(0, 10) : detector.candidates;
  return <SafeAreaView style={styles.safe}>
    <Head><title>Flight Detector · Apunta al cielo</title><meta name="description" content="Encuentra aviones cercanos con tu ubicación, brújula e inclinación del móvil." /></Head>
    <StatusBar style="light" />
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.brand}>FLIGHT / DETECTOR</Text>
          <View style={styles.status}><View style={[styles.dot, detector.running && styles.liveDot]} /><Text style={styles.statusText}>{detector.running ? 'ACTIVO' : 'EN ESPERA'}</Text></View>
        </View>
        <Text style={styles.title}>Apunta al cielo.</Text>
        <Text style={styles.intro}>Descubre qué aviones pasan sobre ti con tu ubicación y la dirección del móvil.</Text>

        <View style={styles.instrument}>
          <View style={styles.row}><Text style={styles.label}>RUMBO VERDADERO</Text><Text style={styles.label}>01 / ORIENTACIÓN</Text></View>
          <View style={styles.compass} accessibilityLabel={heading === null ? 'Rumbo no disponible' : `Rumbo ${heading} grados`}>
            <View style={styles.outerRing} />
            <View style={[styles.cardinals, { transform: [{ rotate: `${-(direction?.headingDegrees ?? 0)}deg` }] }]}>
              <Text style={[styles.cardinal, styles.north]}>N</Text><Text style={[styles.cardinal, styles.east]}>E</Text>
              <Text style={[styles.cardinal, styles.south]}>S</Text><Text style={[styles.cardinal, styles.west]}>O</Text>
              {Array.from({ length: 24 }, (_, index) => <View key={index} style={[styles.tick, { transform: [{ rotate: `${index * 15}deg` }] }]}><View style={styles.tickMark} /></View>)}
            </View>
            <View style={styles.pointer} />
            <View style={styles.compassCenter}><Text style={styles.heading}>{heading === null ? '—' : String(heading).padStart(3, '0')}<Text style={styles.degree}>°</Text></Text><Text style={styles.headingCaption}>{heading === null ? 'ESPERANDO SENSORES' : cardinal(heading)}</Text></View>
          </View>
          <View style={styles.readings}>
            <View><Text style={styles.label}>INCLINACIÓN</Text><Text style={styles.reading}>{direction ? `${direction.elevationDegrees.toFixed(0)}°` : '—'}</Text></View>
            <View><Text style={styles.label}>GPS</Text><Text style={styles.gps}>{detector.position ? `${detector.position.latitude.toFixed(3)}, ${detector.position.longitude.toFixed(3)}` : 'Sin ubicación'}</Text></View>
          </View>
        </View>

        <Text style={styles.instructions}>Sujeta el móvil en vertical, con la pantalla hacia ti. Apunta su borde superior hacia el avión y mantén la posición unos segundos.</Text>
        <Pressable accessibilityRole="button" disabled={detector.starting} onPress={detector.active ? detector.stop : detector.start} style={({ pressed }) => [styles.primary, pressed && styles.pressed, detector.starting && styles.disabled]}>
          <Text style={styles.primaryText}>{detector.starting ? 'Obteniendo ubicación…' : detector.active ? 'Detener detector' : 'Activar detector  ↗'}</Text>
        </Pressable>
        {detector.sensorMessage && detector.active && <Text style={styles.notice}>{detector.sensorMessage}</Text>}
        {detector.message && <Text accessibilityRole="alert" style={styles.notice}>{detector.message}</Text>}

        <View style={styles.sectionTop}>
          <View><Text style={styles.label}>02 / TRÁFICO AÉREO</Text><Text style={styles.sectionTitle}>{nearbyFallback ? 'Aviones cercanos' : 'En tu dirección'}</Text></View>
          {detector.active && <Pressable accessibilityRole="button" accessibilityLabel="Actualizar vuelos" onPress={detector.refresh} disabled={!detector.canRefresh} style={styles.refresh}><Text style={[styles.refreshText, !detector.canRefresh && styles.dimmed]}>{detector.fetching ? 'Consultando…' : 'Actualizar ↻'}</Text></Pressable>}
        </View>
        <Text style={styles.resultsHint}>{!detector.active ? 'Activa el detector para consultar vuelos en tu zona.' : nearbyFallback ? aligned ? 'No hay candidatos a menos de 20° de tu dirección. Estos vuelos están cerca de ti.' : 'Ordenados por distancia. La lista no indica hacia dónde estás apuntando.' : 'Hasta 3 candidatos a menos de 20°. La identificación es aproximada.'}</Text>
        {planes.map((plane, index) => <AircraftRow key={plane.icao24} plane={plane} rank={index + 1} aligned={!nearbyFallback} />)}
        {detector.active && planes.length === 0 && <View style={styles.empty}><Text style={styles.emptyTitle}>{detector.fetching ? 'Buscando vuelos…' : 'Sin vuelos disponibles'}</Text><Text style={styles.resultsHint}>La cobertura de OpenSky puede variar según la zona. La consulta se actualiza cada 30 segundos.</Text></View>}
        <View style={styles.footer}><Pressable accessibilityRole="link" onPress={() => Linking.openURL(detector.source === 'adsb-lol' ? 'https://www.adsb.lol/docs/open-data/api/' : 'https://opensky-network.org').catch(() => {})}><Text style={styles.footerText}>DATOS / {detector.source === 'adsb-lol' ? 'ADSB.LOL · ODbL 1.0' : 'OPENSKY NETWORK'}</Text></Pressable><Text style={styles.footerText}>{detector.updatedAt ? `CONSULTA ${new Date(detector.updatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'GPS + BRÚJULA'}</Text></View>
        {Platform.OS === 'web' && <Text style={styles.installHint}>En iPhone: abre esta web en Safari y utiliza Compartir → Añadir a la pantalla de inicio.</Text>}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.navy }, scroll: { flexGrow: 1 }, content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 36 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, brand: { color: palette.paper, fontSize: 12, letterSpacing: 2, fontWeight: '700' }, status: { flexDirection: 'row', alignItems: 'center', gap: 6 }, statusText: { color: palette.muted, fontSize: 9, letterSpacing: 1 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.muted }, liveDot: { backgroundColor: palette.teal },
  title: { color: palette.paper, fontSize: 40, fontWeight: '600', letterSpacing: -1.5, marginTop: 32 }, intro: { color: palette.muted, fontSize: 15, lineHeight: 23, marginTop: 8, maxWidth: 420 },
  instrument: { marginTop: 28, paddingTop: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line }, label: { color: palette.muted, fontSize: 9, letterSpacing: 1.4 },
  compass: { width: 252, height: 252, alignSelf: 'center', marginVertical: 24, alignItems: 'center', justifyContent: 'center' }, outerRing: { position: 'absolute', width: 190, height: 190, borderRadius: 95, borderColor: palette.line, borderWidth: 1 }, cardinals: { position: 'absolute', width: 252, height: 252 }, cardinal: { position: 'absolute', color: palette.muted, fontFamily: 'SpaceMono', fontSize: 12 }, north: { top: 1, left: 122, color: palette.teal }, east: { top: 117, right: 2 }, south: { bottom: 0, left: 122 }, west: { top: 117, left: 2 }, tick: { position: 'absolute', width: 252, height: 252, alignItems: 'center' }, tickMark: { marginTop: 22, height: 8, width: 1, backgroundColor: palette.line }, pointer: { position: 'absolute', top: 29, width: 2, height: 32, backgroundColor: palette.teal }, compassCenter: { alignItems: 'center' }, heading: { fontFamily: 'SpaceMono', color: palette.paper, fontSize: 49, letterSpacing: -3 }, degree: { fontSize: 24, color: palette.teal }, headingCaption: { color: palette.muted, fontSize: 10, letterSpacing: 2, marginTop: 2 },
  readings: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 18 }, reading: { fontFamily: 'SpaceMono', color: palette.paper, fontSize: 22, marginTop: 5 }, gps: { color: palette.paper, fontFamily: 'SpaceMono', fontSize: 11, marginTop: 10 },
  instructions: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 20 }, primary: { backgroundColor: palette.teal, paddingVertical: 17, alignItems: 'center', borderRadius: 5, marginTop: 18 }, primaryText: { color: palette.navy, fontSize: 15, fontWeight: '700' }, pressed: { opacity: 0.8 }, disabled: { opacity: 0.6 }, notice: { color: palette.amber, fontSize: 13, lineHeight: 20, marginTop: 14 },
  sectionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginTop: 38 }, sectionTitle: { color: palette.paper, fontSize: 24, letterSpacing: -0.5, marginTop: 7 }, refresh: { paddingVertical: 8 }, refreshText: { color: palette.teal, fontSize: 12 }, dimmed: { opacity: 0.4 }, resultsHint: { color: palette.muted, fontSize: 12, lineHeight: 19, marginTop: 10, marginBottom: 8 },
  aircraft: { flexDirection: 'row', borderTopWidth: 1, borderColor: palette.line, paddingVertical: 19, gap: 14 }, rank: { fontFamily: 'SpaceMono', color: palette.teal, fontSize: 11, paddingTop: 5 }, aircraftBody: { flex: 1 }, callsign: { color: palette.paper, fontFamily: 'SpaceMono', fontSize: 20 }, deviation: { color: palette.teal, fontFamily: 'SpaceMono', fontSize: 12 }, country: { color: palette.muted, fontSize: 12, marginTop: 3 }, details: { color: palette.muted, fontSize: 12, lineHeight: 20, marginTop: 7 }, flightLink: { alignSelf: 'flex-start', paddingTop: 11, paddingBottom: 3 }, flightLinkText: { color: palette.paper, fontSize: 12 }, empty: { borderTopWidth: 1, borderColor: palette.line, paddingVertical: 24, marginTop: 12 }, emptyTitle: { color: palette.paper, fontSize: 15 }, footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: palette.line, paddingTop: 20, marginTop: 18 }, footerText: { color: palette.muted, fontSize: 8, letterSpacing: 1 }, installHint: { color: palette.muted, fontSize: 11, lineHeight: 18, marginTop: 18 },
});

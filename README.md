# Flight Detector

Una base Expo SDK 57 para un **APK Android** y una **web para iPhone en Safari**, publicada en Vercel. La web se puede añadir a la pantalla de inicio sin una cuenta Apple Developer. La identificación utiliza GPS, rumbo verdadero e inclinación: no utiliza cámara ni fotografías.

## Distribución disponible

- Web: [flight-detector-alpha.vercel.app](https://flight-detector-alpha.vercel.app).
- Código: [AlexBR784/flight-detector en GitHub](https://github.com/AlexBR784/flight-detector).
- APK Android 1.0.0, compilación 2: [descarga desde GitHub Releases](https://github.com/AlexBR784/flight-detector/releases/download/v1.0.0/flight-detector-1.0.0-build2.apk). Copia local en `artifacts/flight-detector-1.0.0-build2.apk` (98.477.108 bytes).
- [Registro de compilación Android](https://expo.dev/accounts/alexbr784/projects/flight-detector/builds/89e5be0e-4273-49d4-ba42-cf15ac45f9d4).

SHA-256 del APK: `4B4EF02D94DCB8D0659FE89BBA6A86EFADDBB888E5D82EFECA913E7089E480AE`.

GitHub Actions ejecuta las comprobaciones de TypeScript, las pruebas y la exportación web en cada push y pull request. Los APK se distribuyen como adjuntos de una Release, fuera del historial de código.

## Uso

Pulsa **Activar detector**, permite ubicación y orientación, sujeta el teléfono en vertical con la pantalla hacia ti y apunta el borde superior hacia el avión. La app muestra hasta tres candidatos a menos de 20° de la dirección indicada, ordenados por desviación angular y después por distancia. Cada resultado incluye indicativo, país de registro, altitud, distancia y enlace a Flightradar24 cuando hay indicativo.

La identificación es aproximada: depende de los sensores y de la cobertura y antigüedad de los datos de OpenSky. Si no hay orientación válida, se muestran los diez vuelos más cercanos, sin atribuirles alineación. Sin coincidencias direccionales también se muestra esta lista con una explicación. Las posiciones o contactos de más de 120 segundos y los vuelos en tierra se descartan. Un vuelo sin altitud puede aparecer en la lista cercana, pero no como candidato direccional.

## Desarrollo y comprobaciones

Requisitos: Node.js 22.13 o superior y npm. Expo Go debe admitir SDK 57.

```bash
npm install
npm run start:go -- --clear
npm run typecheck
npm run test:run
npx expo-doctor
```

Android consulta directamente el endpoint público de OpenSky. No necesita una URL de servidor ni credenciales OpenSky. La app consulta cada 30 segundos mientras está activa; los sensores actualizan los candidatos usando los datos ya descargados. Los límites HTTP 429 respetan `Retry-After`. Las suscripciones y las consultas se detienen al salir de la pantalla o pasar a segundo plano.

La brújula nativa usa `expo-location` y la inclinación el acelerómetro de `expo-sensors`. Safari solicita acceso a `DeviceOrientationEvent` desde el toque del botón y utiliza `webkitCompassHeading`. La declinación magnética se corrige con WMM2025 (`geomagnetism`). No se interpreta una orientación relativa como si fuera norte verdadero.

## APK Android

El perfil `preview` de `eas.json` genera un APK de distribución interna que funciona sin Expo Go ni el servidor de desarrollo. La primera compilación requiere iniciar sesión y vincular el proyecto a tu cuenta Expo:

```bash
npx eas-cli login
npx eas-cli init
npm run build:android:apk
```

Al completar la compilación, EAS proporciona el enlace de descarga del APK. Instálalo en Android y concede permiso de ubicación. El paquete es `com.flightdetector.app`; mantenlo estable después de distribuirlo. EAS puede gestionar la firma de Android durante la primera compilación. La compilación de un APK Android no requiere una cuenta Apple Developer.

El perfil `production` genera un AAB para una futura publicación en Google Play:

```bash
npx eas-cli build --platform android --profile production
```

## Web iPhone en Vercel

`vercel.json` configura la exportación estática de Expo a `dist` y la función `api/flights.ts`. Despliega **la raíz del proyecto**, incluyendo esa función; publicar solamente `dist` dejaría la consulta de vuelos sin servidor.

La función se ejecuta en Frankfurt (`fra1`) para consultar OpenSky desde Europa.

La web usa ADSB.lol como respaldo cuando OpenSky falla o no responde en cuatro segundos desde Vercel. El tiempo total de la consulta sigue limitado a diez segundos. La API identifica la fuente y la interfaz muestra su atribución (ADSB.lol, ODbL 1.0). El respaldo conserva indicativo, posición y altitud, convierte pies a metros y muestra «País no disponible» si no hay ese dato. HTTP 429 se respeta sin cambiar de proveedor para evitar el límite. Android mantiene la consulta directa a OpenSky.

```bash
npm run build:web
npx vercel login
npx vercel --prod
```

También puedes importar el repositorio en Vercel: Framework Preset **Other**, Build Command **npm run build:web**, Output Directory **dist**, Node.js **22.x**. Vercel entrega la URL HTTPS, necesaria para los permisos de ubicación y sensores en Safari. No hacen falta secretos para el endpoint público de OpenSky.

Para probar localmente interfaz y API juntas:

```bash
npm run build:web
npm run web:vercel
```

`npm run web` sirve la interfaz con Expo, pero **no ejecuta la función `/api/flights`**. Para consultar vuelos en web utiliza Vercel Dev o el despliegue HTTPS. Una IP local servida por HTTP no permite validar los sensores de un iPhone; usa el despliegue HTTPS en el dispositivo real.

Abre la URL publicada en **Safari**. Para instalar el acceso: **Compartir → Añadir a la pantalla de inicio**. Se incluyen manifiesto, icono y metadatos para abrirla como aplicación. La consulta de vuelos necesita conexión; no se implementa un modo sin conexión.

El proxy `/api/flights?latitude=40.4&longitude=-3.7` acepta únicamente GET y coordenadas válidas. Consulta una ventana fija de ±0,3°, limita cada petición a diez segundos, almacena respuestas correctas durante quince segundos en la CDN y transmite el tiempo de espera de OpenSky. No admite destinos arbitrarios. El proxy evita la restricción CORS que impide consultar OpenSky directamente desde Safari.

## Validación en dispositivos

Las pruebas automatizadas cubren geometría, rumbo 359°/0°, exclusión de aviones detrás del usuario, datos incompletos y antiguos, ranking, conversión de inclinación y validación y errores del proxy. Antes de distribuir, comprueba en Android e iPhone reales:

- Activación y denegación de GPS y sensores; recuperación al volver a activar.
- Rumbo con referencias conocidas, inclinación al levantar el borde superior y calibración.
- Lista cercana cuando el dispositivo no tiene brújula o no la permite.
- Pausa al pasar a segundo plano y reanudación al volver.
- Consulta HTTPS, enlaces externos y acceso desde la pantalla de inicio de iPhone.

## Referencias

- [APK Android con EAS](https://docs.expo.dev/build-reference/apk/).
- [Publicación web de Expo](https://docs.expo.dev/guides/publishing-websites/).
- [Funciones de Vercel](https://vercel.com/docs/functions/runtimes/node-js).
- [Modelo magnético WMM de geomagnetism](https://github.com/naturalatlas/geomagnetism).
- [API pública ADSB.lol y licencia ODbL 1.0](https://www.adsb.lol/docs/open-data/api/).

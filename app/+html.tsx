import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Html({ children }: PropsWithChildren) {
  return <html lang="es"><head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Flight Detector · Apunta al cielo</title>
    <meta name="description" content="Encuentra aviones cercanos con tu ubicación, brújula e inclinación del móvil." />
    <meta name="theme-color" content="#0B1D2C" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Flight Detector" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icon.png" />
    <ScrollViewStyleReset />
    <style>{`html, body { background: #0B1D2C; }`}</style>
  </head><body>{children}</body></html>;
}

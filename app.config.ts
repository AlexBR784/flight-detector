import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config: baseConfig }: ConfigContext): ExpoConfig => {
  const easProjectId = process.env.EAS_PROJECT_ID ?? baseConfig.extra?.eas?.projectId;
  return {
  ...baseConfig,
  name: 'Flight Detector',
  slug: 'flight-detector',
  scheme: 'flight-detector',
  version: '1.0.0',
  android: {
    ...baseConfig.android,
    package: 'com.flightdetector.app',
    blockedPermissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'],
  },
  plugins: [
    'expo-router',
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Flight Detector necesita tu ubicación para buscar aviones cercanos.',
      },
    ],
    ['expo-sensors', { motionPermission: 'Flight Detector utiliza la inclinación del móvil para localizar aviones.' }],
    ...(baseConfig.plugins ?? []).filter((plugin) => {
      const name = typeof plugin === 'string' ? plugin : plugin[0];
      return !name || !['expo-router', 'expo-camera', 'expo-location', 'expo-sensors'].includes(name);
    }),
  ],
  extra: {
    ...baseConfig.extra,
    ...(easProjectId
      ? { eas: { ...baseConfig.extra?.eas, projectId: easProjectId } }
      : {}),
  },
  };
};

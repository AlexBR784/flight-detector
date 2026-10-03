import { magneticDeclination, nativeElevation, webElevation } from '../orientationMath';

test('native top-edge elevation accounts for opposite iOS and Android acceleration signs', () => {
  expect(nativeElevation(0, 1, 0, false)).toBeCloseTo(90);
  expect(nativeElevation(0, -1, 0, true)).toBeCloseTo(90);
  expect(nativeElevation(0, 0, 1, false)).toBeCloseTo(0);
  expect(nativeElevation(0, 0, 0, false)).toBeNull();
});
test('web elevation represents the top edge and WMM produces finite declination', () => {
  expect(webElevation(30)).toBeCloseTo(30);
  expect(webElevation(-30)).toBeCloseTo(-30);
  expect(Number.isFinite(magneticDeclination({ latitude: 40.4, longitude: -3.7, altitude: 650 }))).toBe(true);
});

/** @jest-environment node */
import { requestOrientationPermission, subscribeOrientation } from '../orientation.web';

jest.mock('../orientationMath', () => ({ ...jest.requireActual('../orientationMath'), magneticDeclination: () => 2 }));

let browser: EventTarget & { isSecureContext: boolean; innerWidth: number; innerHeight: number; screen: { orientation: { angle: number } } };
const permission = jest.fn();
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const orientationDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'DeviceOrientationEvent');
beforeEach(() => {
  jest.useFakeTimers();
  permission.mockReset().mockResolvedValue('granted');
  browser = Object.assign(new EventTarget(), { isSecureContext: true, innerWidth: 390, innerHeight: 844, screen: { orientation: { angle: 0 } } });
  Object.defineProperty(globalThis, 'window', { value: browser, configurable: true });
  Object.defineProperty(globalThis, 'DeviceOrientationEvent', { value: { requestPermission: permission }, configurable: true });
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
afterAll(() => {
  if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor); else Reflect.deleteProperty(globalThis, 'window');
  if (orientationDescriptor) Object.defineProperty(globalThis, 'DeviceOrientationEvent', orientationDescriptor); else Reflect.deleteProperty(globalThis, 'DeviceOrientationEvent');
});
function emit(values: Record<string, unknown>) {
  jest.advanceTimersByTime(250);
  browser.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta: 30, gamma: 0, alpha: 120, absolute: false, ...values }));
}

test('requests Safari permission synchronously during the original gesture and handles denial', async () => {
  permission.mockResolvedValue('denied');
  const result = requestOrientationPermission();
  expect(permission).toHaveBeenCalledWith(true);
  expect(await result).toBe(false);
  browser.isSecureContext = false;
  permission.mockClear();
  expect(await requestOrientationPermission()).toBe(false);
  expect(permission).not.toHaveBeenCalled();
});
test('corrects Safari magnetic heading, rejects relative alpha and removes subscriptions', () => {
  const reading = jest.fn(), status = jest.fn();
  const cleanup = subscribeOrientation({ latitude: 40, longitude: -3, altitude: 600 }, reading, status);
  emit({ webkitCompassHeading: 358, webkitCompassAccuracy: 10 });
  expect(reading.mock.calls[0][0].headingDegrees).toBe(0);
  expect(reading.mock.calls[0][0].elevationDegrees).toBeCloseTo(30);
  emit({ webkitCompassHeading: -1, webkitCompassAccuracy: -1 });
  expect(reading).toHaveBeenLastCalledWith(null);
  expect(status).toHaveBeenLastCalledWith(expect.stringContaining('rumbo absoluto'));
  cleanup();
  reading.mockClear();
  emit({ webkitCompassHeading: 90 });
  expect(reading).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});
test('accepts explicitly absolute orientation and requires portrait and screen facing up', () => {
  const reading = jest.fn(), status = jest.fn();
  const cleanup = subscribeOrientation({ latitude: 40, longitude: -3, altitude: 600 }, reading, status);
  emit({ absolute: true, alpha: 90 });
  expect(reading.mock.calls[0][0].headingDegrees).toBeCloseTo(270);
  browser.screen.orientation.angle = 90;
  emit({ absolute: true, alpha: 90 });
  expect(reading).toHaveBeenLastCalledWith(null);
  browser.screen.orientation.angle = 0;
  emit({ beta: 110, webkitCompassHeading: 90 });
  expect(reading).toHaveBeenLastCalledWith(null);
  cleanup();
});

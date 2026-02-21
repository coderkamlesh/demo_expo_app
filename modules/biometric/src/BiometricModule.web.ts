import { NativeModule, registerWebModule } from 'expo';
import type {
  BiometricCaptureResult,
  BiometricModuleEvents,
  CaptureOptions,
  RDDeviceInfo,
} from './Biometric.types';

// ─── Web Stub ─────────────────────────────────────────────────────────────────
// UIDAI RD Service hardware (fingerprint scanner, iris camera) is NOT available
// in a browser environment.  All methods throw a descriptive error so developers
// get a clear message instead of a cryptic crash.

class BiometricModule extends NativeModule<BiometricModuleEvents> {
  private _notSupported(method: string): never {
    throw new Error(
      `[BiometricModule] ${method}() is not supported on web.\n` +
      'Connect an Android device with an RD Service APK installed ' +
      '(Morpho, Mantra, Startek, Secugen, etc.) to use biometric capture.'
    );
  }

  async getConnectedDevices(): Promise<RDDeviceInfo[]> {
    this._notSupported('getConnectedDevices');
  }

  async getActiveDevice(): Promise<RDDeviceInfo> {
    this._notSupported('getActiveDevice');
  }

  async discoverRDService(): Promise<boolean> {
    this._notSupported('discoverRDService');
  }

  async startCapture(_options: CaptureOptions): Promise<BiometricCaptureResult> {
    this._notSupported('startCapture');
  }

  async cancelCapture(): Promise<void> {
    this._notSupported('cancelCapture');
  }

  async isDeviceCertValid(): Promise<boolean> {
    this._notSupported('isDeviceCertValid');
  }

  async getDeviceFirmwareVersion(): Promise<string> {
    this._notSupported('getDeviceFirmwareVersion');
  }

  async decodePIDHeader(_pidDataBase64: string): Promise<Record<string, string>> {
    this._notSupported('decodePIDHeader');
  }
}

export default registerWebModule(BiometricModule, 'Biometric');

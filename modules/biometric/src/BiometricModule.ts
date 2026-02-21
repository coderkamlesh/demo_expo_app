import { NativeModule, requireNativeModule } from 'expo';
import type {
  BiometricCaptureResult,
  BiometricModuleEvents,
  CaptureOptions,
  RDDeviceInfo,
} from './Biometric.types';

/**
 * BiometricModule – Native bridge to UIDAI-compliant RD Service devices.
 *
 * Supports:
 *   - Fingerprint  (Morpho, Mantra, Startek, Precision, Secugen …)
 *   - Iris         (Mantra IRIS, Cogent …)
 *   - Face         (UIDAI software-based face auth)
 *
 * Used for:
 *   - AEPS  (Aadhaar Enabled Payment System)
 *   - DMT   (Domestic Money Transfer with Aadhaar OTP / Biometric verification)
 *   - eKYC  (Electronic Know Your Customer)
 *   - BBPS  (Bharat Bill Payment)
 *
 * Quick start:
 *   import BiometricModule from '@/modules/biometric';
 *
 *   // Listen for result
 *   BiometricModule.addListener('onCaptureComplete', (result) => {
 *     if (result.status === 'SUCCESS') {
 *       const { pidData, sessionKey, hmac } = result.pidBlock!;
 *       // send to your AEPS / DMT backend
 *     }
 *   });
 *
 *   // Start fingerprint scan
 *   await BiometricModule.startCapture({ modality: 'FINGER', purpose: 'AEPS' });
 */
declare class BiometricModule extends NativeModule<BiometricModuleEvents> {
  // ─── Device Discovery ─────────────────────────────────────────────────────

  /**
   * Returns all RD service devices currently connected via USB OTG.
   * Returns an empty array when none are connected.
   */
  getConnectedDevices(): Promise<RDDeviceInfo[]>;

  /**
   * Returns info of the currently active / primary RD device.
   * Rejects if no device is connected.
   */
  getActiveDevice(): Promise<RDDeviceInfo>;

  /**
   * Triggers an Android Intent broadcast to discover installed RD Service
   * APKs (Morpho, Mantra, Startek, etc.).
   * Returns true if at least one RD service was found and initialised.
   */
  discoverRDService(): Promise<boolean>;

  // ─── Biometric Capture ────────────────────────────────────────────────────

  /**
   * Starts a biometric capture session using the active RD device.
   *
   * The method resolves with a BiometricCaptureResult and also fires
   * the `onCaptureComplete` event so both Promise and event-listener
   * patterns work.
   *
   * The returned pidBlock (on SUCCESS) is ready to be forwarded directly
   * to your AEPS / DMT banking API endpoint.
   *
   * @param options  Capture settings – modality, purpose, count, timeout, etc.
   */
  startCapture(options: CaptureOptions): Promise<BiometricCaptureResult>;

  /**
   * Cancels the currently running capture session.
   * No-op (silently resolves) if no capture is in progress.
   */
  cancelCapture(): Promise<void>;

  // ─── Device Health ────────────────────────────────────────────────────────

  /**
   * Returns true when the active device holds a valid, non-expired UIDAI
   * certificate.  An expired cert means UIDAI will reject PID blocks.
   */
  isDeviceCertValid(): Promise<boolean>;

  /**
   * Returns the firmware / driver version string of the active RD device.
   */
  getDeviceFirmwareVersion(): Promise<string>;

  // ─── Utilities ───────────────────────────────────────────────────────────

  /**
   * Parses the unencrypted header fields of a PID XML block and returns
   * them as a key-value map.  The encrypted biometric payload is NOT decoded.
   * Useful for debugging / logging purposes.
   *
   * @param pidDataBase64  The `pidData` field from a PIDBlock
   */
  decodePIDHeader(pidDataBase64: string): Promise<Record<string, string>>;
}

// Load the native module from JSI
export default requireNativeModule<BiometricModule>('Biometric');

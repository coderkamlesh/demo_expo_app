// ─── Biometric Types for AEPS / DMT (UIDAI RD Service) ──────────────────────

/** Biometric modality supported by the connected RD device */
export type BiometricModality = 'FINGER' | 'IRIS' | 'FACE';

/** Capture session outcome */
export type CaptureStatus = 'SUCCESS' | 'TIMEOUT' | 'CANCELLED' | 'ERROR';

/**
 * RD Device information as per UIDAI RD Service specification.
 * Returned by getConnectedDevices() and getActiveDevice().
 */
export type RDDeviceInfo = {
  /** Hardware serial number of the RD device */
  serialNumber: string;
  /** Device model e.g. "Morpho MSO 1300 E3", "Mantra MFS100", "Startek FM220U" */
  deviceModel: string;
  /** UIDAI-assigned device ID */
  deviceId: string;
  /** Certificate expiry date in YYYY-MM-DD format */
  certExpiry: string;
  /** Biometric modality the device supports */
  modality: BiometricModality;
  /** RD Service version string */
  rdServiceVersion: string;
  /** Android package name of the RD Service APK */
  rdServicePackage?: string;
};

/**
 * Encrypted PID (Personal Identity Data) block returned after a successful
 * biometric capture. This is the payload sent to AEPS / DMT / KYC APIs.
 *
 * Conforms to UIDAI Auth API v2.5 specification.
 */
export type PIDBlock = {
  /** Base64-encoded encrypted PID XML as per UIDAI spec */
  pidData: string;
  /** HMAC of the PID XML (Base64) – used by UIDAI to verify integrity */
  hmac: string;
  /**
   * Session key used to encrypt pidData.
   * Encrypted with the device's certificate public key (Base64).
   */
  sessionKey: string;
  /** RD service error code; "0" means SUCCESS */
  errorCode: string;
  /** Human-readable error description from RD service */
  errorInfo: string;
  /** ISO-8601 timestamp of when the biometric was captured */
  captureTimestamp: string;
  /** Biometric modality that was captured */
  modality: BiometricModality;
  /** Snapshot of device info at capture time */
  deviceInfo: RDDeviceInfo;
  /** Number of fingers / irises actually captured */
  capturedCount: number;
};

/**
 * Full result returned by startCapture().
 * Delivered both as the Promise resolved value AND via the
 * onCaptureComplete event.
 */
export type BiometricCaptureResult = {
  status: CaptureStatus;
  /** Populated only when status === "SUCCESS" */
  pidBlock?: PIDBlock;
  /** Human-readable status message */
  message: string;
  /** Native error string (only when status === "ERROR") */
  error?: string;
};

/**
 * Options passed when starting a biometric capture session.
 */
export type CaptureOptions = {
  /** Which modality to capture */
  modality: BiometricModality;
  /**
   * Transaction purpose label (shown in native UI and forwarded to UIDAI).
   * Examples: "AEPS", "DMT", "EKYC", "WITHDRAWAL"
   */
  purpose?: string;
  /**
   * Number of fingers / irises to capture in a single session.
   * Ignored for FACE modality. Default: 1, Max: 2.
   */
  count?: number;
  /** Capture timeout in seconds before auto-cancel. Default: 60 */
  timeout?: number;
  /** Show the native RD service capture UI overlay. Default: true */
  showNativeUI?: boolean;
  /** Wrapper for Aadhaar Data Hash (WADH), provided by your backend AUA. Mandatory for Face RD authentication to succeed. */
  wadh?: string;
};

// ─── Native Events ────────────────────────────────────────────────────────────

export type BiometricModuleEvents = {
  /** Fired when an RD device is plugged in and ready */
  onDeviceConnected: (params: { device: RDDeviceInfo }) => void;
  /** Fired when the RD device is unplugged */
  onDeviceDisconnected: (params: { serialNumber: string }) => void;
  /**
   * Fired during an active capture session to report placement progress.
   * progress is 0-100.
   */
  onCaptureProgress: (params: { progress: number; message: string }) => void;
  /** Fired when a capture session ends (success, timeout, cancel, or error) */
  onCaptureComplete: (params: BiometricCaptureResult) => void;
};

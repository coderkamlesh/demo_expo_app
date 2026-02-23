import { NativeModule, requireNativeModule } from 'expo';

export type AEPSCaptureResult = {
  status: 'SUCCESS' | 'FAILURE';
  errCode: string;
  errInfo: string;
  pidData: string;
  hmac: string;
  sessionKey: string;
  ci: string;
  deviceInfo: {
    dpId: string;
    rdsId: string;
    rdsVer: string;
    dc: string;
    mi: string;
    mc: string;
  };
  rawXml: string; // The original full PID block XML
};

declare class BiometricModule extends NativeModule {
  // Discovery function: string lega, boolean dega (true/false)
  isAppInstalled(packageName: string): boolean;

  // Capture function: 3 strings lega, aur result me AEPS JSON object ka Promise dega
  captureBiometric(packageName: string, action: string, pidOptions: string): Promise<AEPSCaptureResult>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<BiometricModule>('Biometric');
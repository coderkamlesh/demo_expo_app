import { NativeModule, requireNativeModule } from 'expo';
import { BiometricModuleEvents } from './Biometric.types';

declare class BiometricModule extends NativeModule<BiometricModuleEvents> {
  // Discovery function: string lega, boolean dega (true/false)
  isAppInstalled(packageName: string): boolean;

  // Capture function: 3 strings lega, aur result me XML string ka Promise dega
  captureBiometric(packageName: string, action: string, pidOptions: string): Promise<string>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<BiometricModule>('Biometric');
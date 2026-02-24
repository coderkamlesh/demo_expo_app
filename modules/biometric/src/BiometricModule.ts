import { NativeModule, requireNativeModule } from 'expo';
import { BiometricModuleEvents, BiometricOptions } from './Biometric.types';

declare class BiometricModule extends NativeModule<BiometricModuleEvents> {
  isAppInstalled(packageName: string): boolean;
  openPlayStore(packageName: string): void;
  launchRdService(options: BiometricOptions): Promise<string>;
}

export default requireNativeModule<BiometricModule>('Biometric');
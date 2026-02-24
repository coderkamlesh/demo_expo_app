import { NativeModule, requireNativeModule } from 'expo';
import { BiometricModuleEvents } from './Biometric.types';

declare class BiometricModule extends NativeModule<BiometricModuleEvents> {
  isAppInstalled(packageName: string): boolean;
  openPlayStore(packageName: string): void;
  launchRdService(pkg: string, pidXml: string): Promise<string>;
}

export default requireNativeModule<BiometricModule>('Biometric');
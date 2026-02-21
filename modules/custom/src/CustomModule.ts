import { NativeModule, requireNativeModule } from 'expo';

import { CustomModuleEvents } from './Custom.types';

declare class CustomModule extends NativeModule<CustomModuleEvents> {
  hello(): string;
  test(): string;
  testAsync(): Promise<string>;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<CustomModule>('Custom');

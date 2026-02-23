import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './Biometric.types';

type BiometricModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class BiometricModule extends NativeModule<BiometricModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(BiometricModule, 'BiometricModule');

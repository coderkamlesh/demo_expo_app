import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './Custom.types';

type CustomModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class CustomModule extends NativeModule<CustomModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(CustomModule, 'CustomModule');

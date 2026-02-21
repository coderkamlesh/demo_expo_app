import * as React from 'react';

import { BiometricViewProps } from './Biometric.types';

export default function BiometricView(props: BiometricViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}

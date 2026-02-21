import { requireNativeView } from 'expo';
import * as React from 'react';

import { BiometricViewProps } from './Biometric.types';

const NativeView: React.ComponentType<BiometricViewProps> =
  requireNativeView('Biometric');

export default function BiometricView(props: BiometricViewProps) {
  return <NativeView {...props} />;
}

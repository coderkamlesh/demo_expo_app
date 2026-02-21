import { requireNativeView } from 'expo';
import * as React from 'react';

import { CustomViewProps } from './Custom.types';

const NativeView: React.ComponentType<CustomViewProps> =
  requireNativeView('Custom');

export default function CustomView(props: CustomViewProps) {
  return <NativeView {...props} />;
}

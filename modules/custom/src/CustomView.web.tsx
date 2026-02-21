import * as React from 'react';

import { CustomViewProps } from './Custom.types';

export default function CustomView(props: CustomViewProps) {
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

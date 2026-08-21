import { requireNativeView } from 'expo';
import * as React from 'react';
import { View } from 'react-native';

import { MellowVisionViewProps } from './MellowVision.types';
import { isMellowVisionAvailable } from './MellowVisionModule';

const NativeView: React.ComponentType<MellowVisionViewProps> | null = isMellowVisionAvailable
  ? requireNativeView('MellowVision')
  : null;

export default function MellowVisionView(props: MellowVisionViewProps) {
  if (!NativeView) return <View style={props.style} />;
  return <NativeView {...props} />;
}

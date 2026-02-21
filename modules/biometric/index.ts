// Reexport the native module.
// On web it resolves to BiometricModule.web.ts (stub)
// On Android/iOS it resolves to BiometricModule.ts (real native bridge)

export * from './src/Biometric.types';
export { default } from './src/BiometricModule';


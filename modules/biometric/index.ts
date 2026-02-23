// Reexport the native module. On web, it will be resolved to BiometricModule.web.ts
// and on native platforms to BiometricModule.ts
export { default } from './src/BiometricModule';
export { default as BiometricView } from './src/BiometricView';
export * from  './src/Biometric.types';

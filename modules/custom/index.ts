// Reexport the native module. On web, it will be resolved to CustomModule.web.ts
// and on native platforms to CustomModule.ts
export { default } from './src/CustomModule';
export { default as CustomView } from './src/CustomView';
export * from  './src/Custom.types';

export type BiometricOptions = {
  pkg: string;
  pidXml: string;
};

// FIX: Events ko object format mein define karein
export type BiometricModuleEvents = {
  onChange: (event: any) => void;
};
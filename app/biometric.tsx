import React, { useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import BiometricModule from '../modules/biometric'; // Apne module ka path check karein

// ─────────────────────────────────────────────
// Constants & Logic (Aapka Diya Hua)
// ─────────────────────────────────────────────
export const BIOMETRIC_PROVIDERS = [
    { id: 'mantra_fp', label: 'Mantra L0 Fingerprint', package: 'com.mantra.rdservice', modality: 'f' },
    { id: 'mantra_l1_fp', label: 'Mantra L1 Fingerprint', package: 'com.mantra.mfs110.rdservice', modality: 'f' },
    { id: 'morpho_fp', label: 'Morpho L0 Fingerprint', package: 'com.scl.rdservice', modality: 'f' },
    { id: 'morpho_l1_fp', label: 'Morpho L1 Fingerprint', package: 'com.idemia.l1rdservice', modality: 'f' },
    { id: 'mantra_iris', label: 'Mantra Iris', package: 'com.mantra.mis100v2.rdservice', modality: 'i' },
    { id: 'precision_fp', label: 'Precision Fingerprint', package: 'com.precision.pb510.rdservice', modality: 'f' },
    { id: 'next_fp', label: 'Next Biometrics Fingerprint', package: 'com.nextbiometrics.onetouchrdservice', modality: 'f' },
    { id: 'face_rd', label: 'Aadhaar Face RD', package: 'in.gov.uidai.facerd', modality: 'p' }
];

export const generatePidOptions = (modality: string, env = 'P', wadh: string | null = null) => {
    let fCount = "0", iCount = "0", pCount = "0";

    if (modality === 'f') fCount = "1";
    else if (modality === 'i') iCount = "1";
    else if (modality === 'p') pCount = "1";

    const wadhAttr = wadh ? ` wadh="${wadh}"` : "";

    return `<PidOptions ver="1.0">
   <Opts fCount="${fCount}" fType="2" iCount="${iCount}" iType="0" pCount="${pCount}" pType="0" format="0" pidVer="2.0" timeout="10000" env="${env}"${wadhAttr} />
</PidOptions>`;
};
// ─────────────────────────────────────────────

export default function Biometric() {
    const [selectedProvider, setSelectedProvider] = useState(BIOMETRIC_PROVIDERS[1]); // Default Mantra L1

    const checkInstallation = async () => {
        const isInstalled = BiometricModule.isAppInstalled(selectedProvider.package);
        Alert.alert("Check Status", `${selectedProvider.label} is ${isInstalled ? "Installed ✅" : "Not Installed ❌"}`);
    };

    const captureBiometric = async () => {
        try {
            // 1. Check if installed
            const isInstalled = BiometricModule.isAppInstalled(selectedProvider.package);
            if (!isInstalled) {
                Alert.alert("Error", "RD Service not installed. Opening Play Store...");
                BiometricModule.openPlayStore(selectedProvider.package);
                return;
            }

            // 2. Generate PID Options
            const pidXml = generatePidOptions(selectedProvider.modality);

            Alert.alert("Capturing", `Launching ${selectedProvider.label}...`);

            // 3. Launch Native Module
            const resultXml = await BiometricModule.launchRdService(
                selectedProvider.package,
                pidXml
            );

            console.log("✅ Captured XML:", resultXml);
            Alert.alert("Success", "Biometric captured successfully! Check console for XML.");

        } catch (error: any) {
            console.error("❌ Error:", error);
            Alert.alert("Failed", error.message);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Select RD Service</Text>

            <ScrollView style={styles.list}>
                {BIOMETRIC_PROVIDERS.map((provider) => (
                    <Button
                        key={provider.id}
                        title={`${provider.label} ${selectedProvider.id === provider.id ? "✅" : ""}`}
                        onPress={() => setSelectedProvider(provider)}
                        color={selectedProvider.id === provider.id ? "green" : "gray"}
                    />
                ))}
            </ScrollView>

            <View style={styles.actions}>
                <Button title="Check Installation" onPress={checkInstallation} color="orange" />
                <Button title="Start Capture" onPress={captureBiometric} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    list: { maxHeight: 300, marginBottom: 20 },
    actions: { gap: 10 }
});
import React from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';
import { BIOMETRIC_PROVIDERS } from '../constants/biometric.constants';
import BiometricModule from '../modules/biometric'; // Auto-generated wrapper
import { generatePidOptions } from '../utils/biometric.utils';

interface BiometricProvider {
    id: string;
    label: string;
    package: string;
    action?: string;
    modality: string;
}

const Biometric = () => {
    const handleCapture = async (provider: BiometricProvider) => {
        // Step 1: Discovery (Check if RD Service is installed)
        const isInstalled = BiometricModule.isAppInstalled(provider.package);

        if (!isInstalled) {
            Alert.alert(
                "App Not Installed",
                `${provider.label} is not installed on your device. Do you want to download it from the Play Store?`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Download", onPress: () => BiometricModule.openPlayStore(provider.package) }
                ]
            );
            return;
        }

        // Step 2: Generate PID Options using the modality
        // Aap yahan apna backend se aaya 'wadh' bhi pass kar sakte hain
        const pidOptionsXml = generatePidOptions(provider.modality, 'P', null);

        // Step 3: Trigger Capture Intent
        try {
            const result = await BiometricModule.captureBiometric(
                provider.package,
                provider.action || "",
                pidOptionsXml
            );

            // Note: Native module returns a JSON string array [pidData, deviceInfo]
            console.log("Capture Result: ", result);
            Alert.alert("Success", "Biometric data captured successfully.");

        } catch (error: any) {
            console.error("Capture Failed: ", error);
            Alert.alert("Error", error.message || "Something went wrong during capture.");
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Select Biometric Device</Text>

            {BIOMETRIC_PROVIDERS.map((provider: any) => (
                <View key={provider.id} style={styles.buttonWrapper}>
                    <Button
                        title={`Scan with ${provider.label}`}
                        onPress={() => handleCapture(provider)}
                    />
                </View>
            ))}
        </View>
    );
};

export default Biometric;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 15,
        backgroundColor: '#f5f5f5',
        padding: 20
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333'
    },
    buttonWrapper: {
        width: '100%',
        marginVertical: 5
    }
});
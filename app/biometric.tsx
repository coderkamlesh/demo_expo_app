import React from 'react';
import { Alert, Button, Text, View } from 'react-native';
import { BIOMETRIC_PROVIDERS } from '../constants/biometric.constants';
import BiometricModule from '../modules/biometric'; // Auto-generated wrapper
import { generatePidOptions } from '../utils/biometric.utils';

interface BiometricProvider {
    id: string;
    label: string;
    package: string;
    action: string;
    modality: string;
}

const Biometric = () => {
    const handleCapture = async (provider: BiometricProvider) => {
        // Step 1: Discovery (Check if RD Service is installed)
        const isInstalled = BiometricModule.isAppInstalled(provider.package);

        if (!isInstalled) {
            Alert.alert("App Not Found", `${provider.label} is not installed on your device.`);
            return;
        }

        // Step 2: Generate PID Options using the modality
        // Aap yahan apna backend se aaya 'wadh' bhi pass kar sakte hain
        const pidOptionsXml = generatePidOptions(provider.modality, 'P', null);

        // Step 3: Trigger Capture Intent
        try {
            const resultXml = await BiometricModule.captureBiometric(
                provider.package,
                provider.action,
                pidOptionsXml
            );

            console.log("Capture Success! XML Data: ", resultXml);
            Alert.alert("Success", "Biometric data captured successfully.");
            // Next: Is resultXml ko apne backend par bhej dein

        } catch (error: any) {
            console.error("Capture Failed: ", error);
            Alert.alert("Error", error.message || "Something went wrong during capture.");
        }
    };

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 15 }}>
            <Text style={{ fontSize: 20, marginBottom: 20 }}>Select Biometric Device</Text>

            {BIOMETRIC_PROVIDERS.map((provider: any) => (
                <Button
                    key={provider.id}
                    title={`Scan with ${provider.label}`}
                    onPress={() => handleCapture(provider)}
                />
            ))}
        </View>
    );
};

export default Biometric;
import CustomModule from "@/modules/custom/src/CustomModule";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function Index() {
  const router = useRouter();
  const [helloResult, setHelloResult] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [asyncResult, setAsyncResult] = useState<string | null>(null);

  useEffect(() => {
    setHelloResult(CustomModule.hello());
    setTestResult(CustomModule.test());
  }, []);

  const handleTestAsync = async () => {
    const result = await CustomModule.testAsync();
    setAsyncResult(result);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>🔧 Module Playground</Text>

      {/* ── Biometric Module Card (navigate to biometric page) ── */}
      <TouchableOpacity
        style={styles.biometricCard}
        activeOpacity={0.8}
        onPress={() => router.push("/biometric" as any)}
      >
        <View style={styles.biometricIcon}>
          <Text style={styles.biometricIconText}>🫆</Text>
        </View>
        <View style={styles.biometricCardText}>
          <Text style={styles.biometricTitle}>Biometric Module</Text>
          <Text style={styles.biometricSubtitle}>
            Fingerprint · Iris · Face — AEPS / DMT
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {/* ── Custom Module Demo (existing) ── */}
      <Text style={styles.sectionLabel}>Custom Module</Text>

      <View style={styles.card}>
        <Text style={styles.label}>hello()</Text>
        <Text style={styles.result}>{helloResult ?? "Loading..."}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>test()</Text>
        <Text style={styles.result}>{testResult ?? "Loading..."}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>testAsync()</Text>
        <Text style={styles.result}>
          {asyncResult ?? "Press button to call"}
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleTestAsync}>
          <Text style={styles.buttonText}>Run testAsync()</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 14,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  /* ── Biometric card ── */
  biometricCard: {
    width: "100%",
    backgroundColor: "#1a1040",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#6366f1",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  biometricIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#6366f122",
    alignItems: "center",
    justifyContent: "center",
  },
  biometricIconText: { fontSize: 26 },
  biometricCardText: { flex: 1 },
  biometricTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#a5b4fc",
  },
  biometricSubtitle: {
    fontSize: 12,
    color: "#6366f1",
    marginTop: 2,
  },
  chevron: {
    fontSize: 28,
    color: "#6366f1",
    fontWeight: "300",
  },
  /* ── Section label ── */
  sectionLabel: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    color: "#555",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 4,
  },
  /* ── Custom module cards ── */
  card: {
    width: "100%",
    backgroundColor: "#1e1e1e",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#2e2e2e",
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: "monospace",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  result: {
    fontSize: 17,
    fontWeight: "600",
    color: "#4ade80",
    fontFamily: "monospace",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#6366f1",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
});

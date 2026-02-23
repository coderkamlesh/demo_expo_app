import type {
    BiometricCaptureResult,
    BiometricModality,
    CaptureOptions
} from "@/modules/biometric";
import BiometricModule from "@/modules/biometric";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    PermissionsAndroid,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

// ─── Device / Modality options shown in the selector ─────────────────────────
type DeviceOption = {
    id: string;
    label: string;
    subLabel: string;
    modality: BiometricModality;
    icon: string;
    color: string;
    accentBg: string;
};

const DEVICE_OPTIONS: DeviceOption[] = [
    {
        id: "morpho_finger",
        label: "Morpho Fingerprint",
        subLabel: "MSO 1300 E3 / MSO 300",
        modality: "FINGER",
        icon: "🖐️",
        color: "#f472b6",
        accentBg: "#f472b611",
    },
    {
        id: "mantra_finger",
        label: "Mantra Fingerprint",
        subLabel: "MFS100 / MFS110",
        modality: "FINGER",
        icon: "🫆",
        color: "#60a5fa",
        accentBg: "#60a5fa11",
    },
    {
        id: "mantra_iris",
        label: "Mantra Iris",
        subLabel: "MIS100 / MIS100V2",
        modality: "IRIS",
        icon: "👁️",
        color: "#34d399",
        accentBg: "#34d39911",
    },
    {
        id: "face_auth",
        label: "Face Auth",
        subLabel: "UIDAI Software-Based Face",
        modality: "FACE",
        icon: "🙂",
        color: "#fbbf24",
        accentBg: "#fbbf2411",
    },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function BiometricScreen() {
    const router = useRouter();

    const [selected, setSelected] = useState<DeviceOption>(DEVICE_OPTIONS[0]);
    const [capturing, setCapturing] = useState(false);
    const [result, setResult] = useState<BiometricCaptureResult | null>(null);
    const [rdFound, setRdFound] = useState<boolean | null>(null);
    const [wadh, setWadh] = useState("");

    // Check for RD service on mount
    useEffect(() => {
        BiometricModule.discoverRDService()
            .then(setRdFound)
            .catch(() => setRdFound(false));

        // Listen for capture result
        const sub = BiometricModule.addListener(
            "onCaptureComplete",
            (res: BiometricCaptureResult) => {
                setCapturing(false);
                setResult(res);
                console.log("\n====== BIOMETRIC CAPTURE RESULT (LISTENER) ======");
                console.log(JSON.stringify(res, null, 2));
                console.log("=================================================\n");
            }
        );

        return () => sub.remove();
    }, []);

    // ── Capture handler ──────────────────────────────────────────────────────
    const handleCapture = async () => {
        if (capturing) return;
        setResult(null);

        // AadhaarFaceRD needs camera permission granted at runtime before launch.
        // Without this, it returns RESULT_CANCELED (0) immediately.
        if (selected.modality === "FACE" && Platform.OS === "android") {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.CAMERA,
                {
                    title: "Camera Permission",
                    message:
                        "Face capture requires camera access. " +
                        "Please allow camera permission to proceed.",
                    buttonPositive: "Allow",
                    buttonNegative: "Deny",
                }
            );
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                setResult({
                    status: "ERROR",
                    message: "Camera permission denied. Face capture requires camera access.",
                });
                return;
            }
        }

        setCapturing(true);

        const opts: CaptureOptions = {
            modality: selected.modality,
            purpose: "AEPS",
            count: 1,
            timeout: 60,
            showNativeUI: true,
            wadh: wadh,
        };

        try {
            const res = await BiometricModule.startCapture(opts);
            console.log("\n====== BIOMETRIC CAPTURE RESULT (DIRECT CALL) ======");
            console.log(JSON.stringify(res, null, 2));
            console.log("====================================================\n");
            // onCaptureComplete listener already sets state; this is a fallback
            setResult(res);
        } catch (err: any) {
            console.error("Biometric Capture Error:", err);
            setResult({
                status: "ERROR",
                message: err?.message ?? "Unknown error",
                error: String(err),
            });
        } finally {
            setCapturing(false);
        }
    };

    const handleCancel = async () => {
        await BiometricModule.cancelCapture();
        setCapturing(false);
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <ScrollView
            style={styles.root}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.heading}>Biometric Capture</Text>
                <Text style={styles.subHeading}>AEPS · DMT · eKYC</Text>
            </View>

            {/* RD Service status badge */}
            <View
                style={[
                    styles.statusBadge,
                    {
                        backgroundColor:
                            rdFound === null
                                ? "#1e1e1e"
                                : rdFound
                                    ? "#052e16"
                                    : "#2d0000",
                        borderColor:
                            rdFound === null ? "#333" : rdFound ? "#16a34a" : "#dc2626",
                    },
                ]}
            >
                <Text style={styles.statusDot}>
                    {rdFound === null ? "⏳" : rdFound ? "🟢" : "🔴"}
                </Text>
                <Text
                    style={[
                        styles.statusText,
                        { color: rdFound === null ? "#888" : rdFound ? "#4ade80" : "#f87171" },
                    ]}
                >
                    {rdFound === null
                        ? "Detecting RD Service…"
                        : rdFound
                            ? "RD Service Found"
                            : "No RD Service APK detected"}
                </Text>
            </View>

            {/* Device selector */}
            <Text style={styles.sectionLabel}>Select Device / Modality</Text>
            <View style={styles.selectorGrid}>
                {DEVICE_OPTIONS.map((opt) => {
                    const isActive = selected.id === opt.id;
                    return (
                        <TouchableOpacity
                            key={opt.id}
                            style={[
                                styles.selectorCard,
                                {
                                    borderColor: isActive ? opt.color : "#2a2a2a",
                                    backgroundColor: isActive ? opt.accentBg : "#161616",
                                },
                            ]}
                            activeOpacity={0.75}
                            onPress={() => {
                                setSelected(opt);
                                setResult(null);
                            }}
                        >
                            <Text style={styles.selectorIcon}>{opt.icon}</Text>
                            <Text style={[styles.selectorLabel, isActive && { color: opt.color }]}>
                                {opt.label}
                            </Text>
                            <Text style={styles.selectorSub}>{opt.subLabel}</Text>
                            {isActive && (
                                <View style={[styles.selectedDot, { backgroundColor: opt.color }]} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* WADH Input for Face Auth */}
            {selected.modality === "FACE" && (
                <View style={styles.wadhContainer}>
                    <Text style={styles.wadhLabel}>WADH Token (Face Auth)</Text>
                    <TextInput
                        style={styles.wadhInput}
                        placeholder="Enter WADH from your backend APIs..."
                        placeholderTextColor="#666"
                        value={wadh}
                        onChangeText={setWadh}
                    />
                </View>
            )}

            {/* Capture / Cancel button */}
            {capturing ? (
                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                    <ActivityIndicator color="#fff" size="small" style={{ marginRight: 10 }} />
                    <Text style={styles.captureBtnText}>Scanning… Tap to Cancel</Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={[
                        styles.captureBtn,
                        { backgroundColor: selected.color },
                        !rdFound && styles.captureBtnDisabled,
                    ]}
                    activeOpacity={0.8}
                    onPress={handleCapture}
                    disabled={rdFound === false}
                >
                    <Text style={styles.captureBtnText}>
                        {selected.icon}  Capture {selected.modality === "FINGER" ? "Fingerprint" : selected.modality === "IRIS" ? "Iris" : "Face"}
                    </Text>
                </TouchableOpacity>
            )}

            {/* Result section */}
            {result && <ResultCard result={result} accentColor={selected.color} />}
        </ScrollView>
    );
}

// ─── Result Card component ────────────────────────────────────────────────────
function ResultCard({
    result,
    accentColor,
}: {
    result: BiometricCaptureResult;
    accentColor: string;
}) {
    const isSuccess = result.status === "SUCCESS";
    const pid = result.pidBlock;

    return (
        <View style={styles.resultContainer}>
            {/* Status row */}
            <View
                style={[
                    styles.resultStatus,
                    {
                        backgroundColor: isSuccess ? "#052e1680" : "#2d000080",
                        borderColor: isSuccess ? "#16a34a" : "#dc2626",
                    },
                ]}
            >
                <Text style={styles.resultStatusIcon}>{isSuccess ? "✅" : "❌"}</Text>
                <View>
                    <Text
                        style={[
                            styles.resultStatusText,
                            { color: isSuccess ? "#4ade80" : "#f87171" },
                        ]}
                    >
                        {result.status}
                    </Text>
                    <Text style={styles.resultStatusMsg}>{result.message}</Text>
                </View>
            </View>

            {/* Error */}
            {!isSuccess && result.error && (
                <DataRow label="Error" value={result.error} mono valueColor="#f87171" />
            )}

            {/* PID Block fields */}
            {isSuccess && pid && (
                <>
                    <Text style={styles.pidSectionTitle}>📦 PID Block (UIDAI)</Text>

                    <DataRow
                        label="Modality"
                        value={pid.modality}
                        valueColor={accentColor}
                    />
                    <DataRow label="Capture Time" value={pid.captureTimestamp} />
                    <DataRow label="Error Code" value={pid.errorCode} />
                    <DataRow label="Error Info" value={pid.errorInfo} />
                    <DataRow
                        label="Captured Count"
                        value={String(pid.capturedCount)}
                    />

                    <Text style={styles.pidSectionTitle}>🔐 Encrypted Payload</Text>
                    <DataRow label="PID Data" value={pid.pidData || "—"} mono truncate />
                    <DataRow label="Session Key" value={pid.sessionKey || "—"} mono truncate />
                    <DataRow label="HMAC" value={pid.hmac || "—"} mono truncate />

                    {pid.deviceInfo && (
                        <>
                            <Text style={styles.pidSectionTitle}>🔌 Device Info</Text>
                            <DataRow label="Device Model" value={pid.deviceInfo.deviceModel || "—"} />
                            <DataRow label="Device ID" value={pid.deviceInfo.deviceId || "—"} mono />
                            <DataRow label="Serial No" value={pid.deviceInfo.serialNumber || "—"} mono />
                            <DataRow label="RD Version" value={pid.deviceInfo.rdServiceVersion || "—"} />
                            <DataRow label="Cert Expiry" value={pid.deviceInfo.certExpiry || "—"} />
                            <DataRow label="RD Package" value={pid.deviceInfo.rdServicePackage || "—"} mono />
                        </>
                    )}
                </>
            )}
        </View>
    );
}

// ─── DataRow helper ───────────────────────────────────────────────────────────
function DataRow({
    label,
    value,
    mono = false,
    truncate = false,
    valueColor,
}: {
    label: string;
    value: string;
    mono?: boolean;
    truncate?: boolean;
    valueColor?: string;
}) {
    return (
        <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>{label}</Text>
            <Text
                style={[
                    styles.dataValue,
                    mono && styles.dataValueMono,
                    valueColor ? { color: valueColor } : null,
                ]}
                numberOfLines={truncate ? 2 : undefined}
                ellipsizeMode="middle"
            >
                {value}
            </Text>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#0a0a0a" },
    scroll: { padding: 20, paddingBottom: 60, gap: 16 },

    /* Header */
    header: { marginBottom: 4, gap: 4 },
    backBtn: { alignSelf: "flex-start", marginBottom: 6 },
    backBtnText: { color: "#6366f1", fontSize: 16, fontWeight: "600" },
    heading: {
        fontSize: 28,
        fontWeight: "800",
        color: "#ffffff",
        letterSpacing: 0.3,
    },
    subHeading: { fontSize: 13, color: "#555", letterSpacing: 1 },

    /* Status badge */
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    statusDot: { fontSize: 16 },
    statusText: { fontSize: 13, fontWeight: "600" },

    /* Section label */
    sectionLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#444",
        letterSpacing: 1.5,
        textTransform: "uppercase",
    },

    /* Device selector grid */
    wadhContainer: {
        marginTop: 10,
        marginBottom: 10,
    },
    wadhLabel: {
        fontSize: 12,
        color: "#ccc",
        marginBottom: 6,
        fontWeight: "600",
    },
    wadhInput: {
        backgroundColor: "#161616",
        borderWidth: 1,
        borderColor: "#333",
        borderRadius: 10,
        padding: 12,
        color: "#fff",
        fontSize: 14,
    },
    selectorGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    selectorCard: {
        width: "47%",
        borderRadius: 14,
        borderWidth: 1.5,
        padding: 14,
        gap: 4,
        position: "relative",
    },
    selectorIcon: { fontSize: 28, marginBottom: 4 },
    selectorLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: "#ccc",
    },
    selectorSub: { fontSize: 11, color: "#555", lineHeight: 15 },
    selectedDot: {
        position: "absolute",
        top: 10,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
    },

    /* Buttons */
    captureBtn: {
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
    },
    captureBtnDisabled: { opacity: 0.35 },
    cancelBtn: {
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        backgroundColor: "#374151",
        gap: 4,
    },
    captureBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
        letterSpacing: 0.3,
    },

    /* Result container */
    resultContainer: {
        borderRadius: 16,
        backgroundColor: "#111",
        borderWidth: 1,
        borderColor: "#222",
        overflow: "hidden",
        gap: 0,
    },
    resultStatus: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#1f1f1f",
    },
    resultStatusIcon: { fontSize: 24 },
    resultStatusText: { fontSize: 16, fontWeight: "800" },
    resultStatusMsg: { fontSize: 12, color: "#777", marginTop: 2 },

    /* PID section title */
    pidSectionTitle: {
        fontSize: 11,
        fontWeight: "700",
        color: "#444",
        letterSpacing: 1.5,
        textTransform: "uppercase",
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 6,
        borderTopWidth: 1,
        borderTopColor: "#1a1a1a",
    },

    /* DataRow */
    dataRow: {
        flexDirection: "row",
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: "#161616",
        gap: 10,
        alignItems: "flex-start",
    },
    dataLabel: {
        width: 100,
        fontSize: 11,
        color: "#555",
        fontWeight: "700",
        letterSpacing: 0.5,
        textTransform: "uppercase",
        paddingTop: 2,
        flexShrink: 0,
    },
    dataValue: {
        flex: 1,
        fontSize: 13,
        color: "#d0d0d0",
        lineHeight: 19,
    },
    dataValueMono: {
        fontFamily: "monospace",
        fontSize: 12,
        color: "#a5b4fc",
    },
});

export const generatePidOptions = (modality, env = 'P', wadh = null) => {
    // Default sabko 0 rakhenge
    let fCount = "0";
    let iCount = "0";
    let pCount = "0";

    // Modality ke base par specific sensor ka count 1 karenge
    if (modality === 'f') {
        fCount = "1";
    } else if (modality === 'i') {
        iCount = "1";
    } else if (modality === 'p') {
        pCount = "1";
    }

    // Agar wadh provide kiya gaya hai, toh attribute add karenge
    const wadhAttr = wadh ? ` wadh="${wadh}"` : "";

    // XML string return karenge
    return `<PidOptions ver="1.0">
   <Opts fCount="${fCount}" fType="2" iCount="${iCount}" iType="0" pCount="${pCount}" pType="0" format="0" pidVer="2.0" timeout="10000" env="${env}"${wadhAttr} />
</PidOptions>`;
};
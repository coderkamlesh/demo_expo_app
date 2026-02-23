export const BIOMETRIC_PROVIDERS = [
    {
        id: 'mantra_fp',
        label: 'Mantra Fingerprint',
        package: 'com.mantra.rdservice',
        action: 'in.gov.uidai.rdservice.fp.CAPTURE',
        modality: 'f' // f = finger
    },
    {
        id: 'morpho_fp',
        label: 'Morpho Fingerprint',
        package: 'com.scl.rdservice',
        action: 'in.gov.uidai.rdservice.fp.CAPTURE',
        modality: 'f'
    },
    {
        id: 'mantra_iris',
        label: 'Mantra Iris',
        package: 'com.mantra.iris.rdservice',
        action: 'in.gov.uidai.rdservice.iris.CAPTURE',
        modality: 'i' // i = iris
    },
    {
        id: 'face_rd',
        label: 'Aadhaar Face RD',
        package: 'in.gov.uidai.facerd',
        action: 'in.gov.uidai.facerd.main.FaceCaptureActivity',
        modality: 'p' // p = photo/face
    }
];
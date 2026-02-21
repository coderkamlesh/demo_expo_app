package expo.modules.biometric

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Base64
import android.util.Log
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import org.json.JSONObject
import org.xml.sax.InputSource
import java.io.StringReader
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.xml.parsers.DocumentBuilderFactory

// ─── RD Service Constants ─────────────────────────────────────────────────────
// UIDAI-defined action strings for communicating with any RD Service APK.
// These are standardised — all certified RD vendors (Morpho, Mantra, Startek,
// Secugen, Precision, Tatvik …) respond to the same intents.

private const val TAG = "BiometricModule"

// Intent actions
private const val ACTION_RDSERVICE_INFO    = "in.gov.uidai.rdservice.fp.INFO"
private const val ACTION_RDSERVICE_CAPTURE = "in.gov.uidai.rdservice.fp.CAPTURE"
private const val ACTION_IRIS_INFO         = "in.gov.uidai.rdservice.iris.INFO"
private const val ACTION_IRIS_CAPTURE      = "in.gov.uidai.rdservice.iris.CAPTURE"
private const val ACTION_FACE_INFO         = "in.gov.uidai.rdservice.face.INFO"
private const val ACTION_FACE_CAPTURE      = "in.gov.uidai.rdservice.face.CAPTURE"

// Keys returned inside the RD service result Intent
private const val KEY_PID_DATA    = "PID_DATA"   // encrypted PID XML (Base64)
private const val KEY_ERRCODE     = "errCode"
private const val KEY_ERRINFO     = "errInfo"

// Request codes used with startActivityForResult
private const val REQ_FINGER_CAPTURE = 1001
private const val REQ_IRIS_CAPTURE   = 1002
private const val REQ_FACE_CAPTURE   = 1003
private const val REQ_FINGER_INFO    = 2001
private const val REQ_IRIS_INFO      = 2002
private const val REQ_FACE_INFO      = 2003

// ─── Data classes ─────────────────────────────────────────────────────────────

class RDDeviceInfoRecord : Record {
  @Field var serialNumber: String = ""
  @Field var deviceModel: String = ""
  @Field var deviceId: String = ""
  @Field var certExpiry: String = ""
  @Field var modality: String = ""
  @Field var rdServiceVersion: String = ""
  @Field var rdServicePackage: String = ""
}

class PIDBlockRecord : Record {
  @Field var pidData: String = ""
  @Field var hmac: String = ""
  @Field var sessionKey: String = ""
  @Field var errorCode: String = "0"
  @Field var errorInfo: String = ""
  @Field var captureTimestamp: String = ""
  @Field var modality: String = ""
  @Field var capturedCount: Int = 0
  @Field var deviceInfo: RDDeviceInfoRecord = RDDeviceInfoRecord()
}

class CaptureResultRecord : Record {
  @Field var status: String = "ERROR"
  @Field var pidBlock: PIDBlockRecord? = null
  @Field var message: String = ""
  @Field var error: String? = null
}

class CaptureOptionsRecord : Record {
  @Field var modality: String = "FINGER"
  @Field var purpose: String = "AEPS"
  @Field var count: Int = 1
  @Field var timeout: Int = 60
  @Field var showNativeUI: Boolean = true
  @Field var wadh: String = ""
}

// ─── Module ───────────────────────────────────────────────────────────────────

class BiometricModule : Module() {

  // Active pending promise (only one capture at a time)
  private var pendingCapturePromise: Promise? = null
  private var currentModality: String = "FINGER"
  private var cachedDeviceInfo: RDDeviceInfoRecord? = null

  override fun definition() = ModuleDefinition {

    Name("Biometric")

    // ─── Events ──────────────────────────────────────────────────────────────

    Events(
      "onDeviceConnected",
      "onDeviceDisconnected",
      "onCaptureProgress",
      "onCaptureComplete"
    )

    // ─── discoverRDService ────────────────────────────────────────────────────
    // Queries the Android PackageManager for any installed RD Service APK
    // that handles the UIDAI fingerprint INFO intent.

    AsyncFunction("discoverRDService") {
      val pm = appContext.reactContext?.packageManager
        ?: throw Exception("PackageManager not available")

      // Check all three modality INFO intents — returns true if ANY RD service is present
      val actions = listOf(ACTION_RDSERVICE_INFO, ACTION_IRIS_INFO, ACTION_FACE_INFO)
      val found = actions.any { action ->
        val intent = Intent(action)
        val apps = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0))
        } else {
          @Suppress("DEPRECATION")
          pm.queryIntentActivities(intent, 0)
        }
        apps.isNotEmpty()
      }
      found
    }

    // ─── getConnectedDevices ──────────────────────────────────────────────────
    // Returns all RD Service APKs found on the device.
    // Each APK represents one connected biometric hardware device.

    AsyncFunction("getConnectedDevices") {
      val pm = appContext.reactContext?.packageManager
        ?: throw Exception("PackageManager not available")

      val intent = Intent(ACTION_RDSERVICE_INFO)
      val resolvedApps = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0))
      } else {
        @Suppress("DEPRECATION")
        pm.queryIntentActivities(intent, 0)
      }

      resolvedApps.map { info ->
        RDDeviceInfoRecord().apply {
          deviceModel       = info.loadLabel(pm).toString()
          rdServicePackage  = info.activityInfo.packageName
          modality          = "FINGER"
          rdServiceVersion  = getPackageVersion(pm, info.activityInfo.packageName)
        }
      }
    }

    // ─── getActiveDevice ──────────────────────────────────────────────────────

    AsyncFunction("getActiveDevice") {
      cachedDeviceInfo ?: throw Exception("No RD device info cached. Call discoverRDService first.")
    }

    // ─── startCapture ─────────────────────────────────────────────────────────
    // Core method: launches the RD service capture Activity, waits for result,
    // parses PID XML, and resolves the promise with the encrypted PID block.

    AsyncFunction("startCapture") { options: CaptureOptionsRecord, promise: Promise ->

      // Only one scan at a time
      if (pendingCapturePromise != null) {
        promise.reject("CAPTURE_IN_PROGRESS", "A capture session is already running", null)
        return@AsyncFunction
      }

      val activity = appContext.activityProvider?.currentActivity
        ?: run {
          promise.reject("NO_ACTIVITY", "No foreground Activity found", null)
          return@AsyncFunction
        }

      pendingCapturePromise = promise
      currentModality = options.modality.uppercase()

      // Build PID Options XML – sent to the RD service to configure the session
      val pidOptions = buildPidOptions(
        modality = currentModality,
        count    = options.count.coerceIn(1, 2),
        timeout  = options.timeout * 1000,       // RD service expects milliseconds
        wadh     = options.wadh
      )

      Log.d(TAG, "PID Options XML: $pidOptions")

      // Choose correct action and request code based on modality
      val (action, reqCode) = when (currentModality) {
        "IRIS" -> Pair(ACTION_IRIS_CAPTURE, REQ_IRIS_CAPTURE)
        "FACE" -> Pair(ACTION_FACE_CAPTURE, REQ_FACE_CAPTURE)
        else   -> Pair(ACTION_RDSERVICE_CAPTURE, REQ_FINGER_CAPTURE)
      }

      val captureIntent = Intent(action).apply {
        if (currentModality == "FACE") {
          putExtra("request", pidOptions)
        } else {
          putExtra("PID_OPTIONS", pidOptions)
        }
      }

      // Check if any RD service can handle this intent
      val pm = activity.packageManager
      val canHandle = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        pm.queryIntentActivities(captureIntent, PackageManager.ResolveInfoFlags.of(0)).isNotEmpty()
      } else {
        @Suppress("DEPRECATION")
        pm.queryIntentActivities(captureIntent, 0).isNotEmpty()
      }

      if (!canHandle) {
        pendingCapturePromise = null
        promise.reject(
          "NO_RD_SERVICE",
          "No RD Service APK found for modality: $currentModality. " +
          "Please install a UIDAI-certified RD service (e.g. Morpho RD Service, Mantra RD Service).",
          null
        )
        return@AsyncFunction
      }

      // Register one-shot activity result listener
      appContext.reactContext?.let { ctx ->
        activity.startActivityForResult(captureIntent, reqCode)
      }
    }

    // ─── cancelCapture ────────────────────────────────────────────────────────

    AsyncFunction("cancelCapture") {
      pendingCapturePromise?.let { p ->
        val result = CaptureResultRecord().apply {
          status  = "CANCELLED"
          message = "Capture cancelled by user"
        }
        p.resolve(result)
        pendingCapturePromise = null
      }
    }

    // ─── isDeviceCertValid ────────────────────────────────────────────────────

    AsyncFunction("isDeviceCertValid") {
      val expiry = cachedDeviceInfo?.certExpiry ?: return@AsyncFunction false
      if (expiry.isBlank()) return@AsyncFunction false
      return@AsyncFunction try {
        val sdf  = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val date = sdf.parse(expiry)
        date != null && date.after(Date())
      } catch (_: Exception) { false }
    }

    // ─── getDeviceFirmwareVersion ──────────────────────────────────────────────

    AsyncFunction("getDeviceFirmwareVersion") {
      cachedDeviceInfo?.rdServiceVersion
        ?: throw Exception("No device info available. Call discoverRDService first.")
    }

    // ─── decodePIDHeader ──────────────────────────────────────────────────────
    // Decodes header XML wrapped around the encrypted biometric PID block.

    AsyncFunction("decodePIDHeader") { pidDataBase64: String ->
      val xml = String(Base64.decode(pidDataBase64, Base64.DEFAULT))
      parsePidHeader(xml)
    }

    // ─── onActivityResult hook ────────────────────────────────────────────────
    // Expo SDK >= 50 exposes onActivityResult in the module definition block.

    OnActivityResult { _, result ->
      val reqCode    = result.requestCode
      val resultCode = result.resultCode
      val data       = result.data

      val isCapture = reqCode in listOf(REQ_FINGER_CAPTURE, REQ_IRIS_CAPTURE, REQ_FACE_CAPTURE)
      val isInfo    = reqCode in listOf(REQ_FINGER_INFO, REQ_IRIS_INFO, REQ_FACE_INFO)

      when {
        isInfo -> handleInfoResult(resultCode, data)
        isCapture -> handleCaptureResult(resultCode, data)
      }
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Handles the INFO intent result to populate cachedDeviceInfo.
   */
  private fun handleInfoResult(resultCode: Int, data: Intent?) {
    if (resultCode != Activity.RESULT_OK || data == null) return
    val deviceInfoXml = data.getStringExtra("RD_SERVICE_INFO") ?: return
    cachedDeviceInfo = parseDeviceInfoXml(deviceInfoXml, currentModality)
    cachedDeviceInfo?.let {
      sendEvent("onDeviceConnected", mapOf("device" to deviceInfoToMap(it)))
    }
  }

  /**
   * Handles the CAPTURE intent result, parses PID XML, and resolves the promise.
   */
  private fun handleCaptureResult(resultCode: Int, data: Intent?) {
    val promise = pendingCapturePromise ?: return
    pendingCapturePromise = null

    // RESULT_OK (-1) is standard; some face RD services (e.g. AadhaarFaceRD) return
    // RESULT_FIRST_USER (1) on success — accept both.
    val isSuccess = resultCode == Activity.RESULT_OK || resultCode == Activity.RESULT_FIRST_USER
    if (!isSuccess) {
      // Even on RESULT_CANCELED, some RD services (especially face) put error details
      // in the Intent extras. Extract them for proper diagnosis.
      val errCode = data?.getStringExtra(KEY_ERRCODE)
        ?: data?.getStringExtra("ERROR_CODE")
        ?: data?.getStringExtra("error_code")
        ?: "unknown"
      val errInfo = data?.getStringExtra(KEY_ERRINFO)
        ?: data?.getStringExtra("ERROR_INFO")
        ?: data?.getStringExtra("error_info")
        ?: data?.getStringExtra("message")
        ?: "No error details returned by RD service"

      // Log ALL extras from result intent for debugging
      val extrasDebug = data?.extras?.keySet()?.joinToString { key ->
        "$key=${data.extras?.get(key)}"
      } ?: "null intent (no data returned)"

      Log.w(TAG, "[$currentModality] RESULT_CANCELED: resultCode=$resultCode | errCode=$errCode | errInfo=$errInfo | allExtras=[$extrasDebug]")

      val captureResult = CaptureResultRecord().apply {
        status  = "CANCELLED"
        message = if (errInfo != "No error details returned by RD service")
          "RD Service Error: $errInfo (code=$errCode)"
        else
          "Capture cancelled or rejected by RD service (resultCode=$resultCode). Check logcat for details."
        error = "errCode=$errCode | $errInfo | extras: $extrasDebug"
      }
      promise.resolve(captureResult)
      sendEvent("onCaptureComplete", captureResultToMap(captureResult))
      return
    }

    val pidDataXml = data?.getStringExtra(KEY_PID_DATA) 
      ?: data?.getStringExtra("response")
    val errCode    = data?.getStringExtra(KEY_ERRCODE) ?: "-1"
    val errInfo    = data?.getStringExtra(KEY_ERRINFO) ?: "Unknown error"

    if (pidDataXml.isNullOrBlank()) {
      val captureResult = CaptureResultRecord().apply {
        status  = "ERROR"
        message = errInfo
        error   = "Empty PID_DATA in RD service response (errCode=$errCode)"
      }
      promise.resolve(captureResult)
      sendEvent("onCaptureComplete", captureResultToMap(captureResult))
      return
    }

    // Parse the PID XML returned by the RD service
    val pidBlock = parsePidXml(pidDataXml, currentModality, errCode, errInfo)
    val captureResult = CaptureResultRecord().apply {
      status  = if (errCode == "0") "SUCCESS" else "ERROR"
      this.pidBlock = pidBlock
      message = if (errCode == "0") "Biometric captured successfully" else errInfo
      error   = if (errCode != "0") errInfo else null
    }

    promise.resolve(captureResult)
    sendEvent("onCaptureComplete", captureResultToMap(captureResult))
  }

  /**
   * Builds the PID Options XML string sent to the RD service.
   * Format is defined in UIDAI RD Service Registration v2.0 specification.
   */
  private fun buildPidOptions(modality: String, count: Int, timeout: Int, wadh: String): String {
    val ts = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).format(Date())
    val fCount = if (modality == "FINGER") count else 0
    val iCount = if (modality == "IRIS")   count else 0
    // pCount = photo count; required by AadhaarFaceRD and other face RD services
    val pCount = if (modality == "FACE")   count else 0

    return """<?xml version="1.0" encoding="UTF-8"?>
<PidOptions ver="1.0">
  <Opts fCount="$fCount" fType="0" iCount="$iCount" iType="0" pCount="$pCount" pType="0" format="0" pidVer="2.0" timeout="$timeout" env="P" wadh="$wadh" posh="UNKNOWN" />
</PidOptions>"""
  }

  /**
   * Parses the PID XML blob returned by the RD service.
   * Extracts:
   *  - Encrypted biometric data (pidData)
   *  - Session key
   *  - HMAC
   *  - Capture timestamp
   *  - Device info fields
   */
  private fun parsePidXml(
    xml: String,
    modality: String,
    errCode: String,
    errInfo: String
  ): PIDBlockRecord {
    val record = PIDBlockRecord().apply {
      this.errorCode  = errCode
      this.errorInfo  = errInfo
      this.modality   = modality
      captureTimestamp = SimpleDateFormat(
        "yyyy-MM-dd'T'HH:mm:ss", Locale.US
      ).format(Date())
    }

    return try {
      val doc     = DocumentBuilderFactory.newInstance().newDocumentBuilder()
        .parse(InputSource(StringReader(xml)))
      val root    = doc.documentElement                                 // <PidData>

      // <Resp errCode="0" errInfo="Capture Successful" fCount="1" …/>
      root.getElementsByTagName("Resp").item(0)?.let { resp ->
        val el = resp as org.w3c.dom.Element
        record.errorCode     = el.getAttribute("errCode").ifEmpty { errCode }
        record.errorInfo     = el.getAttribute("errInfo").ifEmpty { errInfo }
        record.capturedCount = el.getAttribute("fCount").toIntOrNull() ?: 1
      }

      // <DeviceInfo dpId="…" rdsId="…" rdsVer="…" dc="…" mi="…" mc="…" />
      val di = RDDeviceInfoRecord()
      root.getElementsByTagName("DeviceInfo").item(0)?.let { node ->
        val el = node as org.w3c.dom.Element
        di.deviceId        = el.getAttribute("dpId")
        di.rdServiceVersion = el.getAttribute("rdsVer")
        di.certExpiry      = el.getAttribute("dc")
        di.modality        = modality
        // Cache device info so getActiveDevice() works after a successful scan
        cachedDeviceInfo = di
      }
      record.deviceInfo = di

      // <Data type="X">Base64-encoded encrypted PID</Data>
      root.getElementsByTagName("Data").item(0)?.let { node ->
        record.pidData = node.textContent.trim()
      }

      // <Hmac>Base64 HMAC</Hmac>
      root.getElementsByTagName("Hmac").item(0)?.let { node ->
        record.hmac = node.textContent.trim()
      }

      // <SessionKey ci="…">Base64 encrypted session key</SessionKey>
      root.getElementsByTagName("SessionKey").item(0)?.let { node ->
        record.sessionKey = node.textContent.trim()
      }

      record
    } catch (ex: Exception) {
      Log.e(TAG, "Failed to parse PID XML: ${ex.message}", ex)
      // Return what we have – raw XML in pidData so the caller can still try
      record.pidData = Base64.encodeToString(xml.toByteArray(), Base64.NO_WRAP)
      record
    }
  }

  /**
   * Parses the RD_SERVICE_INFO XML to extract device metadata.
   */
  private fun parseDeviceInfoXml(xml: String, modality: String): RDDeviceInfoRecord {
    val di = RDDeviceInfoRecord().apply { this.modality = modality }
    return try {
      val doc = DocumentBuilderFactory.newInstance().newDocumentBuilder()
        .parse(InputSource(StringReader(xml)))
      val root = doc.documentElement
      di.serialNumber     = root.getAttribute("uid").ifEmpty { root.getAttribute("sno") }
      di.deviceId         = root.getAttribute("dpId")
      di.rdServiceVersion = root.getAttribute("rdsVer")
      di.certExpiry       = root.getAttribute("dc")
      di
    } catch (_: Exception) { di }
  }

  /**
   * Extracts only the unencrypted header attributes from a PID XML.
   * The <Data> element (which contains biometric data) is intentionally skipped.
   */
  private fun parsePidHeader(xml: String): Map<String, String> {
    val map = mutableMapOf<String, String>()
    return try {
      val doc  = DocumentBuilderFactory.newInstance().newDocumentBuilder()
        .parse(InputSource(StringReader(xml)))
      val resp = doc.documentElement.getElementsByTagName("Resp").item(0)
      resp?.let { node ->
        val el = node as org.w3c.dom.Element
        listOf("errCode","errInfo","fCount","iCount","pCount","nmPoints")
          .forEach { attr -> map[attr] = el.getAttribute(attr) }
      }
      map
    } catch (_: Exception) { map }
  }

  private fun getPackageVersion(pm: PackageManager, pkg: String): String {
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        pm.getPackageInfo(pkg, PackageManager.PackageInfoFlags.of(0)).versionName ?: ""
      } else {
        @Suppress("DEPRECATION")
        pm.getPackageInfo(pkg, 0).versionName ?: ""
      }
    } catch (_: Exception) { "" }
  }

  // ─── Map converters (for sendEvent – must be plain Map, not Record) ────────

  private fun deviceInfoToMap(d: RDDeviceInfoRecord) = mapOf(
    "serialNumber"     to d.serialNumber,
    "deviceModel"      to d.deviceModel,
    "deviceId"         to d.deviceId,
    "certExpiry"       to d.certExpiry,
    "modality"         to d.modality,
    "rdServiceVersion" to d.rdServiceVersion,
    "rdServicePackage" to d.rdServicePackage
  )

  private fun pidBlockToMap(pb: PIDBlockRecord?) = pb?.let {
    mapOf(
      "pidData"          to it.pidData,
      "hmac"             to it.hmac,
      "sessionKey"       to it.sessionKey,
      "errorCode"        to it.errorCode,
      "errorInfo"        to it.errorInfo,
      "captureTimestamp" to it.captureTimestamp,
      "modality"         to it.modality,
      "capturedCount"    to it.capturedCount,
      "deviceInfo"       to deviceInfoToMap(it.deviceInfo)
    )
  }

  private fun captureResultToMap(r: CaptureResultRecord) = mutableMapOf<String, Any?>(
    "status"   to r.status,
    "message"  to r.message,
    "error"    to r.error,
    "pidBlock" to pidBlockToMap(r.pidBlock)
  )
}

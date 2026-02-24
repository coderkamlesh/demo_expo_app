package expo.modules.biometric

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class BiometricModule : Module() {
  private var pendingPromise: Promise? = null
  private val RD_REQUEST_CODE = 9999

  override fun definition() = ModuleDefinition {
    Name("Biometric")

    // 1) Discovery: is installed & can handle CAPTURE intent
    Function("isAppInstalled") { packageName: String ->
      val activity = appContext.activityProvider?.currentActivity ?: return@Function false
      return@Function try {
        activity.packageManager.getPackageInfo(packageName, 0)
        true
      } catch (e: Exception) {
        false
      }
    }

    // 2) Open Play Store
    Function("openPlayStore") { packageName: String ->
      val activity = appContext.activityProvider?.currentActivity ?: return@Function
      try {
        activity.startActivity(
          Intent(
            Intent.ACTION_VIEW,
            Uri.parse("market://details?id=$packageName")
          )
        )
      } catch (e: Exception) {
        activity.startActivity(
          Intent(
            Intent.ACTION_VIEW,
            Uri.parse("https://play.google.com/store/apps/details?id=$packageName")
          )
        )
      }
    }

    // 3) Capture BIOMETRIC
    AsyncFunction("captureBiometric") { packageName: String, action: String, pidOptions: String, promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.reject("ERR_ACTIVITY", "Current activity not found")
        return@AsyncFunction
      }

      if (packageName.isBlank() || pidOptions.isBlank()) {
        promise.reject("INVALID_ARGS", "pkg or pidXml missing")
        return@AsyncFunction
      }

      // Prevent stacking multiple promises
      if (pendingPromise != null) {
        pendingPromise?.reject("ERR_IN_PROGRESS", "Another capture is already in progress")
        pendingPromise = null
      }

      pendingPromise = promise

      val intentAction = when (packageName) {
        "in.gov.uidai.facerd" -> "in.gov.uidai.rdservice.face.CAPTURE"
        "com.mantra.mis100v2.rdservice" -> "in.gov.uidai.rdservice.iris.CAPTURE"
        else -> "in.gov.uidai.rdservice.fp.CAPTURE"
      }

      val isFaceRd = intentAction == "in.gov.uidai.rdservice.face.CAPTURE"

      val intent = Intent(intentAction).apply {
        `package` = packageName
        putExtra(if (isFaceRd) "request" else "PID_OPTIONS", pidOptions)
      }

      if (intent.resolveActivity(activity.packageManager) != null) {
        try {
          activity.startActivityForResult(intent, RD_REQUEST_CODE)
          Log.i("BiometricModule", "RD launched: $intentAction")
        } catch (e: Exception) {
          pendingPromise?.reject("ERR_LAUNCH_FAILED", "Failed to launch RD Service: ${e.message}", e)
          pendingPromise = null
        }
      } else {
        pendingPromise?.reject("RD_NOT_FOUND", "RD Service app not available")
        pendingPromise = null
      }
    }

    // 4) Handle activity result
    OnActivityResult { _, result ->
      if (result.requestCode == RD_REQUEST_CODE) {
        val promise = pendingPromise ?: return@OnActivityResult

        if (result.resultCode != Activity.RESULT_OK || result.data == null) {
           promise.reject("RD_CANCELLED", "RD capture cancelled or failed")
           pendingPromise = null
           return@OnActivityResult
        }

        val extras = result.data?.extras
        var rawXml: String? = null

        extras?.keySet()?.forEach { key ->
            val value = extras.get(key)
            if (rawXml == null && value is String && value.isNotBlank()) {
                rawXml = value
            }
        }

        if (!rawXml.isNullOrBlank()) {
          val pidDataXml = rawXml!!
          
          // Regex parsing to prevent XML DocumentBuilder crashes on slightly malformed XML from vendors
          val errCode = Regex("errCode=\"([^\"]+)\"").find(pidDataXml)?.groupValues?.get(1) ?: "-1"
          val errInfo = Regex("errInfo=\"([^\"]+)\"").find(pidDataXml)?.groupValues?.get(1) ?: "Unknown Error"
          
          val dpId = Regex("dpId=\"([^\"]+)\"").find(pidDataXml)?.groupValues?.get(1) ?: ""
          val rdsId = Regex("rdsId=\"([^\"]+)\"").find(pidDataXml)?.groupValues?.get(1) ?: ""
          val rdsVer = Regex("rdsVer=\"([^\"]+)\"").find(pidDataXml)?.groupValues?.get(1) ?: ""
          val dc = Regex("dc=\"([^\"]+)\"").find(pidDataXml)?.groupValues?.get(1) ?: ""
          val mi = Regex("mi=\"([^\"]+)\"").find(pidDataXml)?.groupValues?.get(1) ?: ""
          val mc = Regex("mc=\"([^\"]+)\"").find(pidDataXml)?.groupValues?.get(1) ?: ""
          
          val ci = Regex("ci=\"([^\"]+)\"").find(pidDataXml)?.groupValues?.get(1) ?: ""
          val sessionKey = Regex("<Skey[^>]*>([^<]+)</Skey>").find(pidDataXml)?.groupValues?.get(1) ?: ""
          val hmac = Regex("<Hmac>([^<]+)</Hmac>").find(pidDataXml)?.groupValues?.get(1) ?: ""
          val pidDataStr = Regex("<Data[^>]*>([^<]+)</Data>").find(pidDataXml)?.groupValues?.get(1) ?: ""

          // Combine exactly as needed for AEPS/DMT APIs
          val resultMap = mapOf(
              "status" to if (errCode == "0") "SUCCESS" else "FAILURE",
              "errCode" to errCode,
              "errInfo" to errInfo,
              "pidData" to pidDataStr,
              "hmac" to hmac,
              "sessionKey" to sessionKey,
              "ci" to ci,
              "deviceInfo" to mapOf(
                  "dpId" to dpId,
                  "rdsId" to rdsId,
                  "rdsVer" to rdsVer,
                  "dc" to dc,
                  "mi" to mi,
                  "mc" to mc
              ),
              "rawXml" to pidDataXml
          )
          
          promise.resolve(resultMap)
        } else {
          promise.reject("EMPTY_RD_DATA", "No RD XML returned")
        }
        
        pendingPromise = null
      }
    }
  }
}
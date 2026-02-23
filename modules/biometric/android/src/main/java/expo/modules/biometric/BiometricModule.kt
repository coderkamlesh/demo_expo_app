package expo.modules.biometric

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class BiometricModule : Module() {
  private var pendingPromise: Promise? = null
  private val RD_SERVICE_REQ_CODE = 9999

  override fun definition() = ModuleDefinition {
    Name("Biometric")

    // 1) Discovery: is installed & can handle CAPTURE intent
    Function("isAppInstalled") { packageName: String ->
      val pm = appContext.reactContext?.packageManager
      if (pm == null) return@Function false

      try {
        // Check package exists
        pm.getApplicationInfo(packageName, 0)

        // Check if this package can handle RD intent
        val intent = Intent("in.gov.uidai.rdservice.fp.CAPTURE")
        intent.setPackage(packageName)
        val handlers = pm.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
        return@Function handlers.isNotEmpty()
      } catch (ex: Exception) {
        return@Function false
      }
    }

    // 2) Capture BIOMETRIC
    AsyncFunction("captureBiometric") { packageName: String, action: String, pidOptions: String, promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.reject("ERR_ACTIVITY", "Current activity not found")
        return@AsyncFunction
      }

      // Prevent stacking multiple promises
      if (pendingPromise != null) {
        pendingPromise?.reject("ERR_IN_PROGRESS", "Another capture is already in progress")
        pendingPromise = null
      }

      try {
        val intent = Intent()
        intent.setPackage(packageName)
        intent.action = action
        intent.putExtra("PID_OPTIONS", pidOptions)
        pendingPromise = promise
        activity.startActivityForResult(intent, RD_SERVICE_REQ_CODE)
      } catch (e: Exception) {
        pendingPromise = null
        promise.reject("ERR_LAUNCH_FAILED", "Failed to launch RD Service: ${e.message}", e)
      }
    }

    // 3) Handle activity result
    OnActivityResult { _, result ->
      if (result.requestCode == RD_SERVICE_REQ_CODE) {
        val promise = pendingPromise
        pendingPromise = null

        if (promise == null) {
          Log.w("BiometricModule", "No pending promise but activity result received")
          return@OnActivityResult
        }

        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
          val pidDataXml = result.data?.getStringExtra("PID_DATA") ?: result.data?.getStringExtra("response")

          if (pidDataXml != null) {
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
            promise.reject("ERR_NO_DATA", "RD Service returned no PID_DATA")
          }

        } else {
          promise.reject("ERR_CANCELLED", "Biometric capture cancelled or failed")
        }
      }
    }
  }
}
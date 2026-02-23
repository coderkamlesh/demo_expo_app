package expo.modules.biometric

import android.app.Activity
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class BiometricModule : Module() {
  private var pendingPromise: Promise? = null
  private val RD_SERVICE_REQ_CODE = 1001

  override fun definition() = ModuleDefinition {
    Name("Biometric")

    // 1. Discovery Function: Check if app is installed
    Function("isAppInstalled") { packageName: String ->
      try {
        val pm = appContext.reactContext?.packageManager
        // Agar package mil gaya toh true return karega
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            pm?.getPackageInfo(packageName, android.content.pm.PackageManager.PackageInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION")
            pm?.getPackageInfo(packageName, 0)
        }
        true
      } catch (e: Exception) {
        // Package nahi mila (Exception aayi), matlab installed nahi hai
        false
      }
    }

    // 2. Capture Function: Send Intent to RD Service
    AsyncFunction("captureBiometric") { packageName: String, action: String, pidOptions: String, promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.reject("ERR_ACTIVITY", "Current activity not found", null)
        return@AsyncFunction
      }

      try {
        val intent = Intent()
        intent.setPackage(packageName)
        intent.setAction(action)
        intent.putExtra("PID_OPTIONS", pidOptions)

        pendingPromise = promise
        
        activity.startActivityForResult(intent, RD_SERVICE_REQ_CODE)
      } catch (e: Exception) {
        promise.reject("ERR_INTENT", "Failed to launch RD Service: ${e.message}", e)
        pendingPromise = null
      }
    }

    // 3. Result Handler: Receive data back from RD Service
    OnActivityResult { _, payload ->
      if (payload.requestCode == RD_SERVICE_REQ_CODE) {
        if (payload.resultCode == Activity.RESULT_OK || payload.resultCode == 1) { // 1 is RESULT_FIRST_USER (used by some face auths)
          val data = payload.data
          val pidData = data?.getStringExtra("PID_DATA") ?: data?.getStringExtra("response")
          
          if (pidData != null) {
            pendingPromise?.resolve(pidData)
          } else {
            pendingPromise?.reject("ERR_NO_DATA", "RD Service returned empty data", null)
          }
        } else {
          pendingPromise?.reject("ERR_CANCELLED", "Biometric capture was cancelled or failed", null)
        }
        pendingPromise = null
      }
    }
  }
}

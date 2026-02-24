package expo.modules.biometric

import android.app.Activity
import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Coded

// Custom Exceptions for better error handling in JS
class RdServiceNotFoundException : Coded {
    override val code: String = "RD_NOT_FOUND"
    override val message: String = "RD Service app not available"
}

class RdCancelledException : Coded {
    override val code: String = "RD_CANCELLED"
    override val message: String = "RD capture cancelled or failed"
}

class EmptyRdDataException : Coded {
    override val code: String = "EMPTY_RD_DATA"
    override val message: String = "No RD XML returned"
}

class BiometricModule : Module() {
    
    private val RD_REQUEST_CODE = 1001
    private var storedPromise: Promise? = null

    override fun definition() = ModuleDefinition {
        Name("Biometric")

        // ─────────────────────────────────────────────
        // 📦 App Installed Check
        // ─────────────────────────────────────────────
        Function("isAppInstalled") { packageName: String ->
            return@Function try {
                appContext.reactContext?.packageManager?.getPackageInfo(packageName, 0)
                true
            } catch (e: Exception) {
                false
            }
        }

        // ─────────────────────────────────────────────
        // 🏪 Open Play Store
        // ─────────────────────────────────────────────
        Function("openPlayStore") { packageName: String ->
            val context = appContext.reactContext ?: return@Function
            try {
                // Try Market Intent
                context.startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$packageName"))
                )
            } catch (e: Exception) {
                // Fallback to Browser
                context.startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$packageName"))
                )
            }
        }

        // ─────────────────────────────────────────────
        // 🔐 Launch RD Service (Async)
        // ─────────────────────────────────────────────
        AsyncFunction("launchRdService") @Throws(Exception::class
        ) { options: Map<String, Any>, promise: Promise ->
            val packageName = options["pkg"] as? String
            val pidXml = options["pidXml"] as? String

            if (packageName == null || pidXml == null) {
                promise.reject("INVALID_ARGS", "Package name or PID XML missing")
                return@AsyncFunction
            }

            val currentActivity = appContext.currentActivity
            if (currentActivity == null) {
                promise.reject("NO_ACTIVITY", "Current activity is null")
                return@AsyncFunction
            }

            // Logic to determine Action (Same as Flutter)
            val intentAction = when (packageName) {
                "in.gov.uidai.facerd" -> "in.gov.uidai.rdservice.face.CAPTURE"
                "com.mantra.mis100v2.rdservice" -> "in.gov.uidai.rdservice.iris.CAPTURE"
                else -> "in.gov.uidai.rdservice.fp.CAPTURE"
            }

            val isFaceRd = intentAction == "in.gov.uidai.rdservice.face.CAPTURE"

            val intent = Intent(intentAction).apply {
                `package` = packageName
                putExtra(
                    if (isFaceRd) "request" else "PID_OPTIONS",
                    pidXml
                )
            }

            // Check if Intent is resolvable
            if (intent.resolveActivity(currentActivity.packageManager) != null) {
                storedPromise = promise
                currentActivity.startActivityForResult(intent, RD_REQUEST_CODE)
            } else {
                promise.reject(RdServiceNotFoundException())
            }
        }

        // ─────────────────────────────────────────────
        // 🔄 Handle Activity Result
        // ─────────────────────────────────────────────
        OnActivityResult { activity, requestCode, resultCode, data ->
            if (requestCode == RD_REQUEST_CODE) {
                handleRdResult(resultCode, data)
            }
        }
    }

    private fun handleRdResult(resultCode: Int, data: Intent?) {
        val promise = storedPromise
        storedPromise = null // Clear memory

        if (promise == null) return

        if (resultCode != Activity.RESULT_OK || data == null) {
            promise.reject(RdCancelledException())
            return
        }

        // Extract XML Data from Extras
        val extras = data.extras
        var rawXml: String? = null

        extras?.keySet()?.forEach { key ->
            val value = extras.get(key)
            if (rawXml == null && value is String && value.isNotBlank()) {
                rawXml = value
            }
        }

        if (!rawXml.isNullOrBlank()) {
            promise.resolve(rawXml)
        } else {
            promise.reject(EmptyRdDataException())
        }
    }
}
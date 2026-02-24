package expo.modules.biometric

import android.app.Activity
import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException

// ─────────────────────────────────────────────
// ❌ Custom Exceptions (CodedException extend karna ZARURI hai)
// ─────────────────────────────────────────────

class RdServiceNotFoundException :
    CodedException("RD_NOT_FOUND", "RD Service app not available", null)

class RdCancelledException :
    CodedException("RD_CANCELLED", "RD capture cancelled or failed", null)

class EmptyRdDataException :
    CodedException("EMPTY_RD_DATA", "No RD XML returned", null)

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
        // FLAG_ACTIVITY_NEW_TASK ZARURI hai reactContext se startActivity ke liye
        // ─────────────────────────────────────────────
        Function("openPlayStore") { packageName: String ->
            val context = appContext.reactContext ?: return@Function
            try {
                val intent = Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=$packageName")
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            } catch (e: Exception) {
                val fallbackIntent = Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/apps/details?id=$packageName")
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(fallbackIntent)
            }
        }

        // ─────────────────────────────────────────────
        // 🔐 Launch RD Service (Async with Promise)
        // Flutter ke handleRdResult logic ka exact mirror
        // ─────────────────────────────────────────────
        AsyncFunction("launchRdService") { options: Map<String, Any>, promise: Promise ->
            val packageName = options["pkg"] as? String
            val pidXml = options["pidXml"] as? String

            if (packageName.isNullOrBlank() || pidXml.isNullOrBlank()) {
                promise.reject(
                    CodedException("INVALID_ARGS", "pkg or pidXml missing", null)
                )
                return@AsyncFunction
            }

            val currentActivity = appContext.currentActivity
            if (currentActivity == null) {
                promise.reject(
                    CodedException("NO_ACTIVITY", "Current activity is null", null)
                )
                return@AsyncFunction
            }

            // ─── Flutter ke exact saath match karta logic ───
            val intentAction = when (packageName) {
                "in.gov.uidai.facerd"            -> "in.gov.uidai.rdservice.face.CAPTURE"
                "com.mantra.mis100v2.rdservice"  -> "in.gov.uidai.rdservice.iris.CAPTURE"
                else                             -> "in.gov.uidai.rdservice.fp.CAPTURE"
            }

            val isFaceRd = intentAction == "in.gov.uidai.rdservice.face.CAPTURE"

            val intent = Intent(intentAction).apply {
                `package` = packageName
                putExtra(
                    if (isFaceRd) "request" else "PID_OPTIONS",
                    pidXml
                )
            }

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
        OnActivityResult { _, requestCode, resultCode, data ->
            if (requestCode == RD_REQUEST_CODE) {
                handleRdResult(resultCode, data)
            }
        }
    }

    // ─────────────────────────────────────────────
    // 📤 RD Result Handler
    // Flutter ke handleRdResult ka direct equivalent
    // ─────────────────────────────────────────────
    private fun handleRdResult(resultCode: Int, data: Intent?) {
        val promise = storedPromise
        storedPromise = null // Memory clear karo

        if (promise == null) return

        if (resultCode != Activity.RESULT_OK || data == null) {
            promise.reject(RdCancelledException())
            return
        }

        val extras = data.extras
        var rawXml: String? = null

        // Flutter ke exact saath — pehli non-blank String value extract karo
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
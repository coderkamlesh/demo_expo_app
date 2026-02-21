package expo.modules.custom

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.URL

class CustomModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("Custom")

    Events("onChange")

    Function("hello") {
      "Hello world! 👋"
    }

    Function("test") {
      "This is only for testing purpose"
    }
   
   AsyncFunction("testAsync") {
    return@AsyncFunction "This is only for testing purpose"
   }

    AsyncFunction("setValueAsync") { value: String ->
  
      sendEvent("onChange", mapOf(
        "value" to value
      ))
    }

    View(CustomView::class) {
      Prop("url") { view: CustomView, url: URL ->
        view.webView.loadUrl(url.toString())
      }

      Events("onLoad")
    }
  }
}

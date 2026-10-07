package com.mellowpet.wear

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.mellowpet.wear.ui.MellowApp

class MainActivity : ComponentActivity() {

  private var bodySensorsGranted by mutableStateOf(false)

  private val askBodySensors =
    registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      bodySensorsGranted = granted
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    bodySensorsGranted = checkSelfPermission(Manifest.permission.BODY_SENSORS) ==
      android.content.pm.PackageManager.PERMISSION_GRANTED

    setContent {
      MellowApp(
        bodySensorsGranted = bodySensorsGranted,
        onAskBodySensors = { askBodySensors.launch(Manifest.permission.BODY_SENSORS) },
      )
    }
  }
}

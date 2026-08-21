Pod::Spec.new do |s|
  s.name           = 'MellowVision'
  s.version        = '2.0.0'
  s.summary        = 'On-device facial signal pipeline for MellowPet'
  s.description    = 'Visible camera preview and local MediaPipe face-landmarker inference.'
  s.author         = 'MellowPet'
  s.homepage       = 'https://github.com/mellowpet'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # 0.10.21 is intentionally pinned: later 0.10.33 CocoaPods artifacts had a
  # confirmed framework-layout regression. Re-evaluate only with an iOS build.
  s.dependency 'MediaPipeTasksVision', '0.10.21'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
  s.resources = 'Resources/face_landmarker.task'
end

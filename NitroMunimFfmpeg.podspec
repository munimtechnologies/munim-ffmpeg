require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "NitroMunimFfmpeg"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/munimtechnologies/munim-ffmpeg.git", :tag => "v#{s.version}" }

  s.source_files = [
    # Implementation (Swift)
    "ios/**/*.{swift}",
    # Autolinking/Registration (Objective-C++)
    "ios/**/*.{m,mm}",
    # Implementation (C++ objects)
    "cpp/**/*.{hpp,cpp}",
  ]

  load 'nitrogen/generated/ios/NitroMunimFfmpeg+autolinking.rb'
  add_nitrogen_files(s)

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  s.dependency 'ffmpeg-kit-ios-full-gpl-alt', '6.0'

  # ffmpeg-kit 6.0 declares negative Level values with an unsigned backing type.
  # Xcode 26 rejects that header when Nitro enables Swift C++ interoperability.
  # The script locates Level.h by globbing, so it survives a change of FFmpegKit pod.
  s.script_phase = {
    :name => 'Patch FFmpegKit Level enum for Xcode 26',
    :script => '"${RUBY_EXECUTABLE:-/usr/bin/ruby}" "${PODS_TARGET_SRCROOT}/scripts/patch-ffmpegkit-level.rb"',
    :execution_position => :before_compile,
  }

  install_modules_dependencies(s)
end

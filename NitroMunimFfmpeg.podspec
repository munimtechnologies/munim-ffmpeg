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
    # C core that drives FFmpeg's in-process command-line tools
    "ios/*.h",
    # Implementation (C++ objects)
    "cpp/**/*.{hpp,cpp}",
  ]

  # FFmpeg 9 and the fftools core, built by scripts/ffmpeg/build-ios.sh.
  s.vendored_libraries = "ios/vendor/lib/*.a"
  s.preserve_paths = "ios/vendor/**/*"
  s.pod_target_xcconfig = {
    "HEADER_SEARCH_PATHS" => "\"$(PODS_TARGET_SRCROOT)/ios/vendor/include\" \"$(PODS_TARGET_SRCROOT)/ios\"",
    "OTHER_LDFLAGS" => "-lbz2 -lz -liconv",
  }
  s.frameworks = "AudioToolbox", "VideoToolbox", "CoreMedia", "AVFoundation", "CoreVideo", "Security"
  s.libraries = "bz2", "z", "iconv", "c++"

  # Must be public so CocoaPods puts it in the module umbrella, which is how the
  # Swift implementation sees the C core.
  s.public_header_files = "ios/munim_ffmpeg_core.h"

  load 'nitrogen/generated/ios/NitroMunimFfmpeg+autolinking.rb'
  add_nitrogen_files(s)

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'

  install_modules_dependencies(s)
end

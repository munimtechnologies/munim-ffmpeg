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

  # FFmpeg 9 and the in-process fftools core. Downloaded by
  # scripts/fetch-binaries.mjs on install, or built by scripts/ffmpeg/build-all.sh.
  s.vendored_frameworks = "ios/MunimFFmpeg.xcframework"
  s.pod_target_xcconfig = {
    "HEADER_SEARCH_PATHS" => "\"$(PODS_TARGET_SRCROOT)/ios\"",
  }
  # CoreText and CoreGraphics are libass's font provider on iOS.
  s.frameworks = "AudioToolbox", "VideoToolbox", "CoreMedia", "AVFoundation", "CoreVideo", "Security", "CoreText", "CoreGraphics"
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

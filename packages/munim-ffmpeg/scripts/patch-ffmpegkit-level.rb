# frozen_string_literal: true

require 'fileutils'
require 'tempfile'

pods_root = ENV.fetch('PODS_ROOT')
build_products = ENV.fetch('PODS_CONFIGURATION_BUILD_DIR')
source_root = File.join(pods_root, 'ffmpeg-kit-ios-https-alt', 'ffmpegkit.xcframework')

# Patch only the two vendored slices and CocoaPods' selected build product. Nitro's
# Swift/C++ bridge imports the selected header after this before-compile phase.
headers = [
  File.join(source_root, 'ios-arm64', 'ffmpegkit.framework', 'Headers', 'Level.h'),
  File.join(source_root, 'ios-arm64_x86_64-simulator', 'ffmpegkit.framework', 'Headers', 'Level.h'),
  File.join(
    build_products,
    'XCFrameworkIntermediates',
    'ffmpeg-kit-ios-https-alt',
    'ffmpegkit.framework',
    'Headers',
    'Level.h'
  ),
].select { |path| File.file?(path) }

abort('munim-ffmpeg: could not find the expected FFmpegKit Level.h') if headers.empty?

unsigned_declaration = 'NS_ENUM(NSUInteger, Level)'
signed_declaration = 'NS_ENUM(NSInteger, Level)'

headers.each do |header|
  contents = File.binread(header)
  next if contents.include?(signed_declaration) && !contents.include?(unsigned_declaration)

  occurrences = contents.scan(unsigned_declaration).length
  abort("munim-ffmpeg: unexpected Level enum declaration in #{header}") unless occurrences == 1

  patched = contents.sub(unsigned_declaration, signed_declaration)
  Tempfile.create(['Level', '.h'], File.dirname(header)) do |temporary|
    temporary.binmode
    temporary.write(patched)
    temporary.flush
    FileUtils.chmod(File.stat(header).mode, temporary.path)
    FileUtils.mv(temporary.path, header)
  end
end

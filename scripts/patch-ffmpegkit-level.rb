# frozen_string_literal: true

require 'fileutils'
require 'tempfile'

# FFmpegKit 6.0 declares `Level` with an unsigned backing type while assigning
# negative values to it. Clang accepts that in Objective-C, but Xcode 26 rejects
# the header once Nitro turns on Swift/C++ interoperability, so every vendored
# and copied copy of Level.h is rewritten to a signed enum before compiling.
#
# The header is located by globbing rather than by pod name: the FFmpegKit
# republishes lay their xcframeworks out differently (`<pod>/ffmpegkit.xcframework`
# versus `<pod>/xcframeworks/ffmpegkit.xcframework`), and the pod itself may be
# swapped for another variant.
pods_root = ENV.fetch('PODS_ROOT')
build_products = ENV.fetch('PODS_CONFIGURATION_BUILD_DIR')

headers = [pods_root, build_products]
          .flat_map { |root| Dir.glob(File.join(root, '**', 'ffmpegkit.framework', 'Headers', 'Level.h')) }
          .uniq
          .select { |path| File.file?(path) }

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

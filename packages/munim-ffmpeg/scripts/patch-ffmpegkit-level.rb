# frozen_string_literal: true

search_roots = [
  File.join(ENV.fetch('PODS_ROOT'), 'ffmpeg-kit-ios-https-alt'),
  ENV['PODS_CONFIGURATION_BUILD_DIR'],
  ENV['CONFIGURATION_BUILD_DIR'],
  ENV['BUILD_DIR'],
].compact.uniq

headers = search_roots.flat_map do |root|
  Dir.glob(File.join(root, '**', 'ffmpegkit.framework', 'Headers', 'Level.h'))
end.uniq

abort('munim-ffmpeg: could not find FFmpegKit Level.h') if headers.empty?

headers.each do |header|
  contents = File.binread(header)
  patched = contents.gsub('NS_ENUM(NSUInteger, Level)', 'NS_ENUM(NSInteger, Level)')
  File.binwrite(header, patched) if patched != contents
end

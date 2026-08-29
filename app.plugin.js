const fs = require('node:fs')
const path = require('node:path')
const {
  withDangerousMod,
  withGradleProperties,
} = require('expo/config-plugins')

const PICK_FIRSTS_PROPERTY = 'android.packagingOptions.pickFirsts'
const CXX_SHARED_LIBRARY = '**/libc++_shared.so'

const PODFILE_MARKER = '# munim-ffmpeg: allow arm64 iOS Simulator builds'
const PODFILE_SNIPPET = `    ${PODFILE_MARKER}
    # The FFmpegKit pod excludes arm64 from Simulator builds, which breaks Apple
    # Silicon Macs even though its xcframework ships an arm64 Simulator slice.
    installer.pods_project.build_configurations.each do |config|
      config.build_settings.delete('EXCLUDED_ARCHS[sdk=iphonesimulator*]')
    end
    installer.aggregate_targets.each do |aggregate_target|
      aggregate_target.xcconfigs.each do |config_name, xcconfig|
        xcconfig.attributes.delete('EXCLUDED_ARCHS[sdk=iphonesimulator*]')
        xcconfig.save_as(Pathname.new(aggregate_target.xcconfig_path(config_name)))
      end
    end
`

function withAndroidPackaging(config) {
  return withGradleProperties(config, (gradleConfig) => {
    const existing = gradleConfig.modResults.find(
      (item) => item.type === 'property' && item.key === PICK_FIRSTS_PROPERTY
    )

    if (existing) {
      const values = new Set(
        existing.value
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      )
      values.add(CXX_SHARED_LIBRARY)
      existing.value = [...values].join(',')
    } else {
      gradleConfig.modResults.push({
        type: 'property',
        key: PICK_FIRSTS_PROPERTY,
        value: CXX_SHARED_LIBRARY,
      })
    }

    return gradleConfig
  })
}

function withSimulatorArchitectures(config) {
  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const podfilePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        'Podfile'
      )

      if (!fs.existsSync(podfilePath)) return modConfig

      const contents = fs.readFileSync(podfilePath, 'utf8')
      if (contents.includes(PODFILE_MARKER)) return modConfig

      const postInstall = /^([ \t]*)post_install do \|(\w+)\|[ \t]*$/m
      const match = contents.match(postInstall)

      if (!match) {
        console.warn(
          'munim-ffmpeg: no post_install block found in the Podfile; arm64 Simulator builds may fail.'
        )
        return modConfig
      }

      const snippet = PODFILE_SNIPPET.replace(/\binstaller\b/g, match[2])
      const patched = contents.replace(
        postInstall,
        (line) => `${line}\n${snippet}`
      )

      fs.writeFileSync(podfilePath, patched)
      return modConfig
    },
  ])
}

module.exports = function withMunimFfmpeg(config) {
  return withSimulatorArchitectures(withAndroidPackaging(config))
}

module.exports.default = module.exports

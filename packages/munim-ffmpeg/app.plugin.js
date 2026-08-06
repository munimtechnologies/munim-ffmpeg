const { withGradleProperties } = require('expo/config-plugins')

const PICK_FIRSTS_PROPERTY = 'android.packagingOptions.pickFirsts'
const CXX_SHARED_LIBRARY = '**/libc++_shared.so'

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

module.exports = function withMunimFfmpeg(config) {
  return withAndroidPackaging(config)
}

module.exports.default = module.exports

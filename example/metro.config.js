const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const root = path.resolve(__dirname, '..')
const config = getDefaultConfig(__dirname)

// The example lives inside the package it consumes, so npm links
// `node_modules/munim-ffmpeg` back to the repository root. Following that link
// would make Metro walk the tree into itself; resolving the package name
// straight to the root directory avoids the cycle.
config.watchFolders = [root]
config.resolver.nodeModulesPaths = [
  path.join(__dirname, 'node_modules'),
  path.join(root, 'node_modules'),
]
config.resolver.extraNodeModules = {
  'munim-ffmpeg': root,
}
config.resolver.blockList = [
  new RegExp(`^${path.join(root, 'node_modules', 'munim-ffmpeg')}/.*$`),
]

module.exports = config

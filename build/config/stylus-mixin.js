const path = require('path')
const isSpecial = process.env.BUILD_TYPE === 'special'

module.exports = function useMixin(style) {
  if (isSpecial) {
    return style
      .import(path.join(__dirname, '../../components/assets/_style/var.special.styl'))
      .import(path.join(__dirname, '../../components/assets/_style/util.styl'))
      .import(path.join(__dirname, '../../node_modules/nib/lib/nib/vendor'))
      .import(path.join(__dirname, '../../node_modules/nib/lib/nib/gradients'))
  } else {
    return style
      .import(path.join(__dirname, '../../components/assets/_style/var.styl'))
      .import(path.join(__dirname, '../../components/assets/_style/util.styl'))
      .import(path.join(__dirname, '../../node_modules/nib/lib/nib/vendor'))
      .import(path.join(__dirname, '../../node_modules/nib/lib/nib/gradients'))
  }
}
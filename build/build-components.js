//? 编译组件库
//* 将组件库里面的源码移动到lib目录
//* 将组件库编译目录下的js文件做babel转换
//* 提取vue组建里面css到单独文件，并把组建内部的js做babel转换
//* 移动全局样式文件global.styl,并转换成css文件

const path = require('path')
const glob = require('glob')
const compiler = require('vueify').compiler
const bluebird = require('bluebird')
const fs = bluebird.promisifyAll(require('fs'))
const copy = require('recursive-copy')
const stylus = require('stylus')
const babel = bluebird.promisifyAll(require('babel-core'))
//! 组件库编译目录
const TARGET_LIB_BASE = 'lib'
//! 组件库源码目录
const SRC_BASE = 'components'
const postcss = require('postcss')
const autoprefixer = require('autoprefixer')


//? 组件库的样式导入全局样式
function babelPluginInsertCssImportForVue ({ types: t }) {
  function computedSameDirCssPosition(filePath) {
    const filePathParse = path.parse(filePath)
    return `./style/${filePathParse.name}.css`
  }
  const globalCssLiteral = '../assets/_style/global.css'
  return {
    visitor: {
      Program(path, state) {
        const importLiteral = computedSameDirCssPosition(state.opts.filePath)
        path.unshiftContainer('body', t.ImportDeclaration([],t.StringLiteral(importLiteral)))
        path.unshiftContainer('body', t.ImportDeclaration([],t.StringLiteral(globalCssLiteral)))
      }
    }
  }
}


//? 联合stylus公共文件编译stylus
function compileVueStylus (content, cb, compiler, filePath) {
  stylus(content)
    .set('filename', filePath)
    .define('url', stylus.url())
    .import(path.join(__dirname, '../components/assets/_style/util.styl'))
    .import(path.join(__dirname, '../components/assets/_style/var.styl'))
    .import(path.join(__dirname, '../node_modules/nib/lib/nib/vendor'))
    .import(path.join(__dirname, '../node_modules/nib/lib/nib/gradients'))
    .render((err, css) => {
      if (err) {
        throw err
      }
      postcss([autoprefixer])
        .process(css)
        .then(result => {
          cb(null, result.css)
        })
    })
}

//? 编译stylus的配置，已经编译js的babel配置
//* 编译出的js是umd格式
function computedCompilerConfig(filePath) {
  return {
    extractCSS: true,
    babel: {
      presets: [
        ['env', {
          'modules': 'umd',
          'targets': {
            'browsers': ['iOS >= 8', 'Android >= 4']
          }
        }],
      ],
      plugins: [
        [babelPluginInsertCssImportForVue, {
          filePath,
        }]
      ]
    },
    customCompilers: {
      stylus: compileVueStylus
    }
  }
}

//? 将组件库里面的源码移动到指定目录
function move(destDir) {
  return new Promise((resolve, reject) => {
    copy(SRC_BASE, destDir, {filter: function(item) {
      if (/demo|test/.test(item)) {
        return false
      }
      if (/^index.js$/.test(item)) {
        return false
      }
      return true
    }}, function (err, result) {
      if (err) {
        reject(err)
      }
      resolve(result)
    })
  })
}

//? 提取组件里面的css，并将组件的js做babel转换
function compileVueAndReplace(filePath) {
  const styleDir = path.join(path.dirname(filePath), 'style')
  if (!fs.existsSync(styleDir)) {
    fs.mkdirSync(styleDir)
  }
  const fileBaseName = path.basename(filePath, '.vue')
  const cssFilePath = path.join(styleDir, `${fileBaseName}.css`)
  const jsFilePath = filePath.replace(/\.vue$/, '.js')
  const fileContent = fs.readFileSync(filePath, {
    encoding: 'utf8',
  })
  const config = computedCompilerConfig(filePath)
  compiler.applyConfig(config)
  let styleContent = ''
  const styleCb = res => {
    if (res.style) {
      styleContent = res.style
    }
  }
  compiler.on('style', styleCb)
  return new Promise((resolve, reject) => {
    compiler.compile(fileContent, filePath, (err, result) => {
      if (err) {
        reject(err)
      }
      compiler.removeListener('style', styleCb)
      fs.writeFileAsync(jsFilePath, result)
      .then(() => fs.writeFileAsync(cssFilePath, styleContent))
      .then(() => {
        return fs.unlinkAsync(filePath)
      })
    })
  })
}

//? js文件做babel转换
function compileJsAndReplace(filePath){
   babel.transformFileAsync(filePath, {
      babelrc: false,
      presets: [
        ['env', {
          'modules': 'umd',
          'targets': {
            'browsers': ['iOS >= 8', 'Android >= 4']
          }
        }]
      ]
   })
    .then(({code}) => {
      return fs.writeFileAsync(filePath, code)
    })
    .catch(error => {
      console.info(`${filePath} build error::error.stack=${error.stack}`)
    })
}

//? stylus转换成css文件
function compileGlobalStylus() {
  const filePath = path.resolve(TARGET_LIB_BASE, 'assets/_style/global.styl')
  const targetPath = path.resolve(TARGET_LIB_BASE, 'assets/_style/global.css')
  const fileContent = fs.readFileSync(filePath, {
    encoding: 'utf8',
  })
  return compileVueStylus(fileContent, (err, cssContent) => {
    fs.writeFileAsync(targetPath, cssContent)
  })

}


//? 将组件库编译目录下的js文件做babel转换
function compileAndReplaceAllJsFile() {
  const fileGlob = `${TARGET_LIB_BASE}/**/*.js`
  const jsFiles = glob.sync(fileGlob)
  return Promise.all(jsFiles.map(compileJsAndReplace))
    .catch(e => {
      console.info(e)
    })
}

//? 提取vue组建里面css到单独文件，并把组建内部的js做babel转换
function compileAndReplaceAllVueFile() {
  const fileGlob = `${TARGET_LIB_BASE}/**/*.vue`
  const jsFiles = glob.sync(fileGlob)
  return Promise.all(jsFiles.map(compileVueAndReplace))
    .catch(e => {
      console.info(e)
    })
}

//* 将组件库里面的源码移动到lib目录
//* 将组件库编译目录下的js文件做babel转换
//* 提取vue组建里面css到单独文件，并把组建内部的js做babel转换
//* 移动全局样式文件global.styl,并转换成css文件
function main() {
  return move('lib')
    .then(() => Promise.all([compileAndReplaceAllJsFile(), compileAndReplaceAllVueFile(), compileGlobalStylus()]))
    .catch(e => console.info(e))
}

main()
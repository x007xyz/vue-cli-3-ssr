const fs = require('fs')
const path = require('path')
const express = require('express')
const { createBundleRenderer } = require('vue-server-renderer')

const resolve = file => path.resolve(__dirname, file)

const app = express()
// 配置页面静态资源路径
const serve = (path, cache) => express.static(resolve(path), {
  maxAge: 0
})
app.use('/js', serve('../dist/js'))
app.use('/img', serve('../dist/img'))
app.use('/css', serve('../dist/css'))
// 页面信息
const context = {
  title: 'Vue CLI 3 SSR example',
  url: ''
}
// 构建渲染方法
const renderer = (bundle, clientManifest) => createBundleRenderer(bundle, {
  runInNewContext: false,
  template: fs.readFileSync(resolve('../src/index.temp.html'), 'utf-8'),
  clientManifest
})
// 构建信息
let bundle = require('../dist/vue-ssr-server-bundle.json')
let manifest = require('../dist/vue-ssr-client-manifest.json')

app.use('*', (req, res) => {
  if (!bundle) {
    res.body = '等待webpack打包完成后在访问在访问'
    return
  }
  context.url = req.originalUrl
  renderer(bundle, manifest).renderToString(context, (err, html) => {
    if (err) {
      if (err.url) {
        console.error('err.url', err.url)
        res.redirect(err.url)
      } else {
        // Render Error Page or Redirect
        res.status(500).end('500 | Internal Server Error')
        console.error(`error during render : ${req.url}`)
        console.error(err.stack)
      }
    }
    res.status(context.HTTPStatus || 200)
    res.send(html)
  })
})

const port = process.env.PORT || 3000

app.listen(port, () => {
  console.log(`server started at localhost:${port}`)
})

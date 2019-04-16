# 实现服务端渲染
## 一、服务端渲染
服务端渲染，顾名思义就是使用服务器渲染页面，这是传统的页面渲染方法，与之相对应的概念就是浏览器渲染，现在前端使用的比较多的构建项目的方式是浏览器渲染，但是因为服务端渲染的很多优势，我们需要将原有的浏览器渲染的项目修改为服务端渲染的方式。
在做项目的服务端渲染之前，首先我们需要考虑是否确实有这样的必要。相对于服务端渲染的方案，使用webpack插件实现预渲染，可以支持少量页面的SEO，而且不需要进行太多的改动。
另外使用传统的服务端渲染+vue客户端渲染的方式也可以适应一部分场景，vue的使用类似于jQuery，html结构、head信息与不进行修改的数据依旧使用服务端渲染，其实与vue ssr的本质是相同的，不过vue ssr服务端依旧使用vue，代码可以进行最大程度的复用，服务端客户端使用同一种方式构建页面，也被认为是同构。
## 二、更改原有的项目
![vue服务端渲染结构](https://cloud.githubusercontent.com/assets/499550/17607895/786a415a-5fee-11e6-9c11-45a2cfdf085c.png)
### 1、避免单例
我们原来的项目使用vue-cli 3创建生成，现在我们需要对原有的项目文件进行一些改动以适应服务端渲染。
客户端渲染我们从一个实例里面取值，这个实例是保存在用户的浏览器内存中的，然而服务端渲染创建实单例是保存在服务器缓存中的，如果使用同一个实例，所有用户对同一个实例进行读写这样显然是有问题的，所以我们首先要对各种实例进行改造，避免单例，主要修改store、router、app实例为可重复执行的工厂函数。
### 2、构建入口
需要为浏览器与服务端分别创建构建入口，此时路由被托管给服务器，在路由确认之后，将在服务端和客户端分别构建页面，所以入口的代码都需要在`router.onReady`之后执行，服务端会改变路由并且可能执行异步方法获取数据，客户端入口只需要构建页面就可以了。
### 3、修改vue cli 3配置
在项目根目录新增vue.config.js，这个文件可以对vue-cli 3的配置进行修改。使用webpack我们希望生成两个文件，一个是用于生成传递给`createBundleRenderer`的 server bundle，一个是生成客户端构建清单 (client build manifest)，两者分别包含了服务端和客户端的构建信息，使用`vue-server-renderer`的createBundleRenderer就可以构建项目了。
为了支持分别生成服务端与客户端文件，我们将传入环境变量`WEBPACK_TARGET`以作区分。
```
  "build": "npm run build:server -- --silent && npm run build:client -- --no-clean --silent",
  "build:client": "vue-cli-service build",
  "build:server": "cross-env WEBPACK_TARGET=node vue-cli-service build",
```
### 4、构建express服务器
在上一个步骤中，我们已经生产了vue服务端渲染需要的相关配置文件，构建express我们需要的是使用vue-server-renderer加载相关的配置文件，然后在express路由将所有的路径都使用vue-server-renderer的createBundleRender方法进行页面渲染。针对页面中的静态文件我们还要配置相应的静态路径，使页面能够获取正确的文件信息。

### 5、实现支持热更新的开发环境
我们现在的方案实际上存在服务端、客户端两端的渲染方案的，所以我们的webpack的配置是需要两套不同的配置，而vue-cli3中启动一个项目是无法同时获取我们想要的两套配置。
>  方案一


使用不同的参数启动两次vue-cli3的服务，每次获取不同的配置，理论上可行，但是实际出现错误：
```
ReferenceError: self is not defined
    at Object.<anonymous> ((webpack)-dev-server/client:57:0)
    at Object../node_modules/webpack-dev-server/client/index.js?http://localhost (main.js:4265:30)
    at __webpack_require__ (webpack/bootstrap:688:0)
    at fn (webpack/bootstrap:59:0)
    at Object.1 (main.js:5142:1)
    at __webpack_require__ (webpack/bootstrap:688:0)
    at main.js:784:37
    at Object.<anonymous> (main.js:787:10)
    at evaluateModule (/Users/zhangxiangchen/Code/Demo/vue-cli-3-ssr/node_modules/vue-server-renderer/build.dev.js:9303:21)
    at /Users/zhangxiangchen/Code/Demo/vue-cli-3-ssr/node_modules/vue-server-renderer/build.dev.js:9361:18
```
相关的配置文件可以获取，但是在createBundleRenderer中使用时，出现错误，原因不明，放弃方案一。
> 方案二


使用webpack生成node端服务器配置，使用vue-cli3生成客户端配置。
```
const webpack = require('webpack')
const MemoryFs = require('memory-fs')
const mfs = new MemoryFs()
// 1、webpack配置文件
const webpackConfig = require('@vue/cli-service/webpack.config')

// 2、编译webpack配置文件
const serverCompiler = webpack(webpackConfig)
// 指定输出到的内存流中
serverCompiler.outputFileSystem = mfs

// 3、监听文件修改，实时编译获取最新的 vue-ssr-server-bundle.json
let bundle
serverCompiler.watch({}, (err, stats) => {
  if (err) {
    throw err
  }
  stats = stats.toJson()
  stats.errors.forEach(error => console.error(error))
  stats.warnings.forEach(warn => console.warn(warn))
  const bundlePath = path.join(
    webpackConfig.output.path,
    'vue-ssr-server-bundle.json'
  )
  bundle = JSON.parse(mfs.readFileSync(bundlePath, 'utf-8'))
  console.log('new bundle generated')
})
```
在开发环境运行时需要添加环境变量`WEBPACK_TARGET=node`这样webpack的配置才是编译`vue-ssr-server-bundle.json`文件的。使用webpack获取配置文件的基本思路就是讲webpack的输出指向为内存流，然后监听文件修改获取配置文件。
```
const getManifest = () => {
  return axios.get('http://localhost:8880/vue-ssr-client-manifest.json').then(res => res.data)
}
```
vue-cli3运行会占用接口，直接读取相应端口的相应文件信息，在vue.config.js中配置`baseUrl: isDev ? 'http://127.0.0.1:8880' : '',`让开发环境的能够顺利获取静态文件资源，这里还需要跨域的配置：
```
devServer: {
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  },
```
此时项目已经可以正常运行了，但是还是无法进行热更新，我们需要把热更新相关的接口请求转发到vue-cli3启动的服务器上：
```
const proxy = require('http-proxy-middleware')
app.use('/sockjs-node', proxy({
  target: `http://localhost:8880/`,
  changeOrigin: true,
  ws: true
}))
```
现在尝试修改文件，项目已经会自动更新了。
### 参考项目：  
> [vue-cli3构建ssr案例一](https://github.com/lentoo/vue-cli-ssr-example)  
> [vue-cli3构建ssr案例二](https://github.com/eddyerburgh/vue-cli-ssr-example)  
> [vue-hackernews-2.0](https://github.com/vuejs/vue-hackernews-2.0)
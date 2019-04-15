import { createApp } from './main'

export default context => {
  return new Promise((resolve, reject) => {
    const { app, router } = createApp()

    router.push(context.url)

    router.onReady(() => {
      const matchedComponents = router.getMatchedComponents()

      if (!matchedComponents.length) {
        reject(new Error('no components matched'))
      }
      resolve(app)
    }, reject)
  })
}

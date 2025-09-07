// Pinia state management plugin
import { createPinia } from 'pinia'

export default defineNuxtPlugin((nuxtApp) => {
  const pinia = createPinia()
  
  // Enable Pinia devtools in development
  if (process.dev) {
    pinia.use(({ store }) => {
      store.$subscribe((mutation, state) => {
        console.log('Pinia mutation:', mutation.type, mutation)
      })
    })
  }
  
  nuxtApp.vueApp.use(pinia)
  
  return {
    provide: {
      pinia
    }
  }
})
import { defineBoot } from '#q-app'
import { installSplashWatchdog } from '@/services/splashScreen'

export default defineBoot(() => {
  installSplashWatchdog()
})

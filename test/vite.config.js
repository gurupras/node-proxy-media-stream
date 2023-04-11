import { defineConfig } from 'vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: '/tmp',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, '..', 'src/proxy-media-stream.js'),
      name: '_ProxyMediaStream',
      formats: ['umd'],
      fileName: '__browser__proxy-media-stream'
    }
  }
})

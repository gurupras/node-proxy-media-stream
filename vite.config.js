import { defineConfig } from 'vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, 'src/proxy-media-stream.js'),
      name: 'ProxyMediaStream',
      formats: ['cjs']
    }
  },
  test: {
    coverage: {
      provider: 'c8'
    },
    setupFiles: ['./test/testSetup.js']
  }
})

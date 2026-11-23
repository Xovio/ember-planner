import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  test: {
    include: ['src/**/*.test.ts'],
    // fixed zone with DST so local-time logic is tested the same on every machine
    env: { TZ: 'Europe/Berlin' }
  }
})

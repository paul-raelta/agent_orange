import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Bind to 0.0.0.0 so you can open the UI from another device on the same
  // LAN (phone, tablet, other laptop). Vite prints a "Network: http://..."
  // URL alongside the local one when this is on.
  server: { host: true, port: 5173 },
})

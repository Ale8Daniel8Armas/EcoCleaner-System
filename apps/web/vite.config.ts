import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

// HTTPS en dev solo cuando se solicita (VITE_HTTPS=true), necesario para la cámara (contexto seguro).
const useHttps = process.env.VITE_HTTPS === 'true'

export default defineConfig({
  plugins: [
    react(),
    ...(useHttps ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'EcoCleaner Hackathon',
        short_name: 'EcoCleaner',
        description: 'App inteligente para dosificación y control de limpieza',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone', // Esto oculta la barra del navegador (parece app nativa)
        icons: [
          {
            src: 'mascota.jpeg', // Ojo: debes poner cualquier logo de 192x192 en tu carpeta public/
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.jpeg', // Y otro logo de 512x512 en public/
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
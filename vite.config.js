import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    // Los .zip y .dc.html sueltos en la raíz (p. ej. exports de referencias de diseño)
    // no son parte de la app y a veces quedan bloqueados por el SO/antivirus,
    // lo que tumbaba el watcher de Vite con EBUSY.
    watch: { ignored: ['**/*.zip', '**/*.dc.html'] },
  },
});

const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    
    // Ahora la ruta apunta a la nueva ubicación DENTRO de frontend.
    screenshotsFolder: 'manual_capturas', 
    
    // Un timeout generoso para evitar fallos por lentitud.
    defaultCommandTimeout: 8000, 
    
    // Desactivamos el archivo de soporte que no usamos.
    supportFile: false,
    
    // Limpiamos capturas viejas antes de cada ejecución.
    trashAssetsBeforeRuns: true,

    setupNodeEvents(on, config) {
      // Ya no necesitamos lógica extra aquí.
    },
  },
});
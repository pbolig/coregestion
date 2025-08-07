const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    // --- CONFIGURACIÓN CLAVE ---
    // Le decimos a Cypress que la dirección base de nuestra aplicación es esta.
    // Todos los comandos cy.visit('/') irán a http://localhost:3000
    baseUrl: 'http://localhost:3000',
    
    // Mantenemos la configuración de capturas que ya funciona.
    screenshotsFolder: 'manual_capturas',
    
    // Un timeout generoso para evitar fallos por lentitud.
    defaultCommandTimeout: 8000, 
    
    // Desactivamos el archivo de soporte que no usamos.
    supportFile: false,
    
    // Limpiamos capturas viejas antes de cada ejecución 'cypress run'.
    trashAssetsBeforeRuns: true,

    setupNodeEvents(on, config) {
      // Aquí no necesitamos lógica extra por ahora.
    },
  },
});

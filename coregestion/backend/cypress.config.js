const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    // Aquí le decimos a Cypress la dirección principal de nuestra aplicación.
    // Todas las pruebas comenzarán visitando esta URL.
    baseUrl: 'http://localhost:3000',
    
    // Esta función se ejecuta antes de que se carguen los archivos de prueba.
    // No necesitamos modificarla por ahora.
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
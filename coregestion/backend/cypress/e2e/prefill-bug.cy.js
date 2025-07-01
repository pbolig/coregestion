// cypress/e2e/prefill-bug.cy.js

describe('Depuración del Pre-llenado de Presupuestos', () => {

  it('Debería pre-seleccionar el cliente correcto al venir de una solicitud', () => {
    // Datos de la solicitud que vamos a simular
    const solicitudData = {
      clienteId: 1, // El ID del cliente "Constructora del Litoral S.R.L."
      descripcion: 'Prueba de pre-llenado desde Cypress'
    };

    // 1. Iniciar sesión como administrador
    cy.visit('/');
    cy.get('#goToInternalLoginBtn').click();
    cy.get('#username').type('admin');
    cy.get('#password').type('admin123');
    cy.get('#loginForm button[type="submit"]').click();
    cy.get('#dashboardView').should('be.visible');

    // 2. Simular la acción del módulo de prospectos
    // Usamos cy.window() para acceder al 'window' del navegador y manipular el sessionStorage.
    cy.window().then((win) => {
      win.sessionStorage.setItem('nuevoPresupuestoDesdeSolicitud', JSON.stringify(solicitudData));
      cy.log('Datos de la solicitud guardados en sessionStorage.');
    });

    // 3. Navegar al módulo de Presupuestos
    cy.get('#main-nav').contains('Presupuestos').click();

    // 4. VERIFICACIÓN DEFINITIVA
    // Ahora, la prueba se centrará en este único punto.
    // Esperamos que el menú desplegable de clientes no solo contenga la opción,
    // sino que su valor seleccionado sea '1'.
    cy.get('#presupuestoCliente').should('have.value', '1');

    // 5. Verificación visual adicional (opcional)
    // Comprobamos que el texto de la opción seleccionada sea el correcto.
    cy.get('#presupuestoCliente option:selected').should('contain.text', 'Constructora del Litoral');
  });

});
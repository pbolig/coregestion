// cypress/e2e/manual/00_flujo_login.cy.js

describe('Manual de Usuario - Flujo de Login', () => {

  it('Debería documentar las diferentes formas de acceso al sistema', () => {
    
    // --- VISTA INICIAL ---
    cy.log('Paso 1: Visitar la página de bienvenida');
    cy.visit('/');
    // Usamos un viewport más ajustado para que la captura se centre en los modales
    cy.viewport(1200, 750); 
    cy.screenshot('manual-00a-vista-bienvenida');

    // --- LOGIN INTERNO ---
    cy.log('Paso 2: Documentar el login interno');
    cy.get('#goToInternalLoginBtn').click();
    cy.get('#internalLoginView').should('be.visible');
    cy.screenshot('manual-00b-login-interno');

    // Volvemos a la bienvenida para el siguiente flujo
    cy.get('#backToWelcomeFromInternal').click();
    cy.get('#welcomeView').should('be.visible');

    // --- PORTAL DE CLIENTES ---
    cy.log('Paso 3: Documentar el portal de clientes');
    cy.get('#goToPortalLoginBtn').click();
    cy.get('#portalLoginView').should('be.visible');
    cy.screenshot('manual-00c-portal-clientes');

    // Opcional: mostrar la vista de registro
    cy.get('#goToRegisterBtn').click();
    cy.get('#portalRegisterView').should('be.visible');
    cy.screenshot('manual-00d-portal-registro');
    cy.get('#backToPortalLogin').click(); // Volver al login

    // Opcional: mostrar la vista de recuperar contraseña
    cy.get('#goToForgotPasswordBtn').click();
    cy.get('#forgotPasswordView').should('be.visible');
    cy.screenshot('manual-00e-portal-recuperar-pass');
  });
});
// cypress/e2e/login.cy.js

// 'describe' agrupa un conjunto de pruebas relacionadas. Es como el título de un capítulo.
describe('Pruebas de Autenticación del Sistema Interno', () => {

  // 'it' define un caso de prueba individual. Es una "escena" específica.
  it('Un administrador debería poder iniciar sesión y ver el dashboard', () => {
    
    // 1. Visitar la página principal.
    // Cypress usa la 'baseUrl' que configuramos en cypress.config.js ('http://localhost:3000')
    cy.visit('/');

    // 2. Hacer clic en el botón para ir al login interno.
    // cy.get() busca un elemento en la página usando selectores de CSS.
    cy.get('#goToInternalLoginBtn').click();

    // 3. Escribir el usuario y la contraseña en los campos correspondientes.
    // .type() simula que un usuario está escribiendo.
    cy.get('#username').type('admin');
    cy.get('#password').type('admin123');

    // 4. Hacer clic en el botón de "Entrar".
    cy.get('#loginForm button[type="submit"]').click();

    // 5. VERIFICACIÓN (Assertions)
    // Aquí es donde le decimos al robot qué resultado esperamos. Si esto no se cumple, la prueba falla.
    
    // Verificamos que la URL ya no sea la de la página de bienvenida.
    cy.url().should('not.eq', 'http://localhost:3000/'); 

    // Verificamos que el dashboard principal esté visible.
    cy.get('#dashboardView').should('be.visible');

    // Y la verificación más importante: que el menú de navegación para el admin se haya cargado.
    cy.get('#main-nav').should('be.visible');
    
    // Podemos incluso verificar que contenga el módulo de "Usuarios".
    cy.get('#main-nav').contains('Usuarios').should('be.visible');
  });

  it('Debería mostrar un mensaje de error con credenciales incorrectas', () => {
    // 1. Visitar la página y ir al login interno
    cy.visit('/');
    cy.get('#goToInternalLoginBtn').click();

    // 2. Escribir credenciales incorrectas
    cy.get('#username').type('admin');
    cy.get('#password').type('password_incorrecto');

    // 3. Enviar el formulario
    cy.get('#loginForm button[type="submit"]').click();

    // 4. VERIFICACIÓN
    // Comprobamos que el mensaje de error aparezca y contenga el texto esperado.
    cy.get('#errorMessage')
      .should('be.visible')
      .and('contain.text', 'Credenciales inválidas');
      
    // Verificamos que nos mantenemos en la página de login
    cy.get('#dashboardView').should('not.be.visible');
  });

});
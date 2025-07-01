// cypress/e2e/clientes.cy.js

describe('Pruebas del Módulo de Clientes', () => {

  beforeEach(() => {
    // Iniciar sesión y navegar al módulo
    cy.visit('/');
    cy.get('#goToInternalLoginBtn').click();
    cy.get('#username').type('admin');
    cy.get('#password').type('admin123');
    cy.get('#loginForm button[type="submit"]').click();
    cy.get('#dashboardView').should('be.visible');
    cy.get('#main-nav').contains('Clientes').click();
  });

  it('Debería permitir crear, editar y eliminar un cliente correctamente', () => {
    const timestamp = Date.now();
    const uniqueClientName = `Cliente Cypress ${timestamp}`;
    const uniqueCuit = `30-${timestamp.toString().slice(-8)}-${timestamp.toString().slice(-1)}`;
    const editedClientName = `${uniqueClientName} (Editado)`;
    
    // --- FASE 1: CREACIÓN ---
    cy.get('#addClientBtn').click();
    cy.get('#clientName').type(uniqueClientName);
    cy.get('#clientCuit').type(uniqueCuit);
    cy.get('#clientEmail').type(`test.${timestamp}@coregestion.com`);
    cy.get('#clientForm button[type="submit"]').click();

    // Verificación de la creación
    cy.get('.notification-area').should('be.visible').and('contain.text', 'creado exitosamente');
    cy.get('#clientsTableBody').contains('td', uniqueClientName).parent('tr').as('clienteRow');

    // --- FASE 2: EDICIÓN ---
    cy.get('@clienteRow').find('.edit-btn').click();
    cy.get('#clientName').clear().type(editedClientName);
    cy.get('#clientForm button[type="submit"]').click();

    // Verificación de la edición
    cy.get('.notification-area').should('be.visible').and('contain.text', 'actualizado exitosamente');
    
    // --- CORRECCIÓN FINAL ---
    // Ahora verificamos que el texto de la celda sea EXACTAMENTE el nuevo nombre.
    // .should('have.text', ...) es una comprobación de igualdad estricta.
    cy.get('@clienteRow').find('td:nth-child(2)') 
      .should('have.text', editedClientName);

    // --- FASE 3: ELIMINACIÓN ---
    cy.get('@clienteRow').find('.delete-btn').click();
      
    // Verificación de la eliminación
    cy.get('.notification-area').should('be.visible').and('contain.text', 'eliminado exitosamente');
    cy.get('#clientsTableBody').contains('td', editedClientName).should('not.exist');
  });

});
// cypress/e2e/manual/08_flujo_clientes.cy.js

describe('Manual de Usuario - Flujo de Gestión de Clientes', () => {

  beforeEach(() => {
    // Antes de cada prueba, iniciamos sesión para tener un token válido.
    cy.visit('/');
    cy.get('#goToInternalLoginBtn').click();
    cy.get('#username').type('admin');
    cy.get('#password').type('admin123');
    cy.get('#loginForm button[type="submit"]').click();
    cy.get('#dashboardView').should('be.visible');
  });

  it('Debería documentar el ciclo completo de un cliente (Crear, Editar, Eliminar)', () => {
    
    // --- NAVEGACIÓN Y VISTA INICIAL ---
    cy.log('Paso 1: Navegar al módulo de Clientes');
    cy.get('#main-nav').contains('Clientes').click();
    cy.get('#clientsTableBody').should('not.contain.text', 'Cargando...');
    cy.screenshot('manual-29-vista-clientes-inicial', { capture: 'viewport' });

    // --- CREACIÓN DE UN NUEVO CLIENTE ---
    cy.log('Paso 2: Crear un nuevo cliente');
    const timestamp = Date.now();
    const uniqueClientName = `Cliente de Manual ${timestamp}`;
    const uniqueCuit = `30-${timestamp.toString().slice(-8)}-${timestamp.toString().slice(-1)}`;
    
    cy.get('#addClientBtn').click();
    cy.get('#clientFormContainer').should('be.visible');
    
    cy.get('#clientName').type(uniqueClientName);
    cy.get('#clientCuit').type(uniqueCuit);
    cy.get('#clientEmail').type(`cliente.manual@test.com`);
    cy.screenshot('manual-30-formulario-nuevo-cliente', { capture: 'viewport' });
    
    cy.intercept('POST', '/api/clientes').as('createCliente');
    cy.get('#clientForm button[type="submit"]').click();
    cy.wait('@createCliente');
    cy.get('.notification-area').should('be.visible');
    cy.screenshot('manual-31-cliente-creado-en-lista', { capture: 'viewport' });

    // --- EDICIÓN DEL CLIENTE ---
    cy.log('Paso 3: Editar el cliente recién creado');
    const editedClientName = `${uniqueClientName} (Editado)`;
    
    cy.get('#clientsTableBody').contains('td', uniqueClientName)
      .parent('tr').find('.edit-btn').click();
      
    cy.get('#clientFormContainer').should('be.visible');
    cy.get('#clientName').clear().type(editedClientName);
    cy.screenshot('manual-32-edicion-cliente', { capture: 'viewport' });

    cy.intercept('PUT', '/api/clientes/*').as('updateCliente');
    cy.get('#clientForm button[type="submit"]').click();
    cy.wait('@updateCliente');
    cy.get('.notification-area').should('be.visible');

    // --- ELIMINACIÓN DEL CLIENTE ---
    cy.log('Paso 4: Eliminar el cliente');
    cy.get('#clientsTableBody').contains('td', editedClientName)
      .parent('tr').find('.delete-btn').click();
      
    // Cypress maneja el confirm() automáticamente.
    cy.get('.notification-area').should('be.visible');
    cy.get('#clientsTableBody').contains('td', editedClientName).should('not.exist');
    cy.screenshot('manual-33-cliente-eliminado', { capture: 'viewport' });
  });
});
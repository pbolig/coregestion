// cypress/e2e/manual/12_flujo_proveedores.cy.js

describe('Manual de Usuario - Flujo de Gestión de Proveedores', () => {

  beforeEach(() => {
    // Antes de cada prueba, iniciamos sesión como administrador.
    cy.visit('/');
    cy.viewport(1400, 900); // Usamos un viewport consistente
    cy.get('#goToInternalLoginBtn').click();
    cy.get('#username').type('admin');
    cy.get('#password').type('admin123');
    cy.get('#loginForm button[type="submit"]').click();
    cy.get('#dashboardView').should('be.visible');
  });

  it('Debería documentar el ciclo completo de un Proveedor (Crear, Editar, Eliminar)', () => {
    
    // --- NAVEGACIÓN Y VISTA INICIAL ---
    cy.log('Paso 1: Navegar al módulo de Proveedores');
    cy.get('#main-nav').contains('Proveedores').click();
    cy.get('#proveedoresTableBody').should('not.contain.text', 'Cargando...');
    cy.screenshot('manual-45-vista-proveedores-inicial', { capture: 'viewport' });

    // --- CREACIÓN DE UN NUEVO PROVEEDOR ---
    cy.log('Paso 2: Crear un nuevo proveedor');
    const timestamp = Date.now();
    const uniqueProviderName = `Proveedor de Insumos ${timestamp}`;
    const uniqueCuit = `30-${timestamp.toString().slice(-8)}-${timestamp.toString().slice(-1)}`;
    
    cy.get('#addProveedorBtn').click();
    cy.get('#proveedorFormContainer').should('be.visible');
    
    cy.get('#proveedorName').type(uniqueProviderName);
    cy.get('#proveedorCuit').type(uniqueCuit);
    cy.screenshot('manual-46-formulario-nuevo-proveedor', { capture: 'viewport' });
    
    cy.intercept('POST', '/api/proveedores').as('createProveedor');
    cy.get('#proveedorForm button[type="submit"]').click();
    cy.wait('@createProveedor');
    cy.get('.notification-area').should('be.visible');
    cy.screenshot('manual-47-proveedor-creado', { capture: 'viewport' });

    // --- EDICIÓN DEL PROVEEDOR ---
    cy.log('Paso 3: Editar el proveedor recién creado');
    const editedProviderName = `${uniqueProviderName} (Editado)`;
    
    cy.get('#proveedoresTableBody').contains('td', uniqueProviderName)
      .parent('tr').find('.edit-btn').click();
      
    cy.get('#proveedorFormContainer').should('be.visible');
    cy.get('#proveedorName').clear().type(editedProviderName);
    cy.screenshot('manual-48-edicion-proveedor', { capture: 'viewport' });

    cy.intercept('PUT', '/api/proveedores/*').as('updateProveedor');
    cy.get('#proveedorForm button[type="submit"]').click();
    cy.wait('@updateProveedor');
    cy.get('.notification-area').should('be.visible');

    // --- ELIMINACIÓN DEL PROVEEDOR ---
    cy.log('Paso 4: Eliminar el proveedor');
    cy.get('#proveedoresTableBody').contains('td', editedProviderName)
      .parent('tr').find('.delete-btn').click();
      
    // Cypress maneja el confirm() automáticamente.
    cy.get('.notification-area').should('be.visible');
    cy.get('#proveedoresTableBody').contains('td', editedProviderName).should('not.exist');
    cy.screenshot('manual-49-proveedor-eliminado', { capture: 'viewport' });
  });
});
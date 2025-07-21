// cypress/e2e/manual/11_flujo_roles.cy.js

describe('Manual de Usuario - Flujo de Gestión de Roles', () => {

  beforeEach(() => {
    // Antes de cada prueba, iniciamos sesión como administrador.
    cy.visit('/');
    cy.get('#goToInternalLoginBtn').click();
    cy.get('#username').type('admin');
    cy.get('#password').type('admin123');
    cy.get('#loginForm button[type="submit"]').click();
    cy.get('#dashboardView').should('be.visible');
  });

  it('Debería documentar la visualización y gestión de roles y permisos', () => {
    
    // --- NAVEGACIÓN Y VISTA INICIAL ---
    cy.log('Paso 1: Navegar al módulo de Roles');
    cy.get('#main-nav').contains('Roles').click();
    cy.get('#rolesTableBody').should('not.contain.text', 'Cargando...');
    cy.screenshot('manual-43-vista-roles', { capture: 'viewport' });

    // --- EDICIÓN DE PERMISOS DE UN ROL ---
    cy.log('Paso 2: Editar los permisos del rol "Ventas"');
    
    // Buscamos la fila del rol "ventas" y hacemos clic en su botón de editar
    cy.get('#rolesTableBody').contains('td', 'ventas')
      .parent('tr').find('.edit-btn').click();
      
    // --- CORRECCIÓN DEFINITIVA: Verificamos el contenedor del formulario ---
    cy.get('#roleFormContainer').should('be.visible');
    cy.screenshot('manual-44-modal-permisos-rol', { capture: 'viewport' });

    // Simplemente cerramos el modal, ya que el objetivo es solo documentar la vista
    cy.get('#cancelBtn').click();
    cy.get('#roleFormContainer').should('not.be.visible');
  });
});
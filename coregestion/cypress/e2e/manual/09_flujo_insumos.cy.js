// cypress/e2e/manual/09_flujo_insumos.cy.js

describe('Manual de Usuario - Flujo de Gestión de Insumos', () => {

  beforeEach(() => {
    // Antes de cada prueba, iniciamos sesión.
    cy.visit('/');
    cy.get('#goToInternalLoginBtn').click();
    cy.get('#username').type('admin');
    cy.get('#password').type('admin123');
    cy.get('#loginForm button[type="submit"]').click();
    cy.get('#dashboardView').should('be.visible');
  });

  it('Debería documentar el ciclo completo de un Insumo/Servicio', () => {
    
    // --- NAVEGACIÓN Y VISTA INICIAL ---
    cy.log('Paso 1: Navegar al módulo de Insumos');
    cy.get('#main-nav').contains('Insumos').click();
    cy.get('#insumosTableBody').should('not.contain.text', 'Cargando...');
    cy.screenshot('manual-34-vista-insumos-inicial', { capture: 'viewport' });

    // --- CREACIÓN DE UN NUEVO INSUMO ---
    cy.log('Paso 2: Crear un nuevo insumo');
    const timestamp = Date.now();
    const uniqueInsumoName = `Panel Solar ${timestamp}`;
    
    cy.get('#showMasterFormBtn').click();
    cy.get('#masterFormContainer').should('be.visible');
    
    cy.get('#masterInsumoNombre').type(uniqueInsumoName);
    cy.get('#masterInsumoUnidad').select('unidad');
    cy.get('#masterInsumoPrecio').type('250000');
    cy.screenshot('manual-35-formulario-nuevo-insumo', { capture: 'viewport' });
    
    cy.intercept('POST', '/api/insumos').as('createInsumo');
    cy.get('#masterForm button[type="submit"]').click();
    cy.wait('@createInsumo');
    cy.get('.notification-area').should('be.visible');
    cy.screenshot('manual-36-insumo-creado-en-lista', { capture: 'viewport' });

    // --- EDICIÓN DEL INSUMO PARA HACERLO RECURRENTE ---
    cy.log('Paso 3: Editar el insumo para marcarlo como recurrente');
    
    cy.get('#insumosTableBody').contains('td', uniqueInsumoName)
      .parent('tr').find('.edit-btn').click();
      
    cy.get('#masterFormContainer').should('be.visible');
    // Marcamos el checkbox
    cy.get('#masterInsumoRecurrente').check();
    cy.screenshot('manual-37-edicion-insumo-recurrente', { capture: 'viewport' });

    cy.intercept('PUT', '/api/insumos/*').as('updateInsumo');
    cy.get('#masterForm button[type="submit"]').click();
    cy.wait('@updateInsumo');
    cy.get('.notification-area').should('be.visible');

    // Verificamos que el cambio se refleje en la tabla
    cy.get('#insumosTableBody').contains('td', uniqueInsumoName)
      .parent('tr').should('contain.text', 'Sí');
    cy.screenshot('manual-38-insumo-marcado-como-recurrente', { capture: 'viewport' });
  });
});
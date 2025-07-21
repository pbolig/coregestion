// cypress/e2e/manual/02_flujo_presupuestos.cy.js

describe('Manual de Usuario - Flujo de Presupuestos y Facturación', () => {

  let testData;

  // Antes de empezar, creamos un cliente de prueba vía API para no depender de datos existentes.
  before(() => {
    const timestamp = Date.now();
    testData = {
      nombre: `Cliente Presupuesto ${timestamp}`,
      email: `presupuesto.${timestamp}@test.com`,
      cuit: `30-${timestamp.toString().slice(-8)}-${timestamp.toString().slice(-1)}`
    };
    cy.request('POST', 'http://localhost:3000/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    }).then((response) => {
      cy.request({
        method: 'POST',
        url: 'http://localhost:3000/api/clientes',
        headers: { 'Authorization': `Bearer ${response.body.token}` },
        body: testData
      });
    });
  });

  it('Debería documentar la creación, avance y facturación de un presupuesto', () => {
    
    // --- LOGIN ---
    cy.visit('/');
    cy.get('#goToInternalLoginBtn').click();
    cy.get('#username').type('admin');
    cy.get('#password').type('admin123');
    cy.get('#loginForm button[type="submit"]').click();
    cy.get('#dashboardView').should('be.visible');

    // --- CREACIÓN DE PRESUPUESTO ---
    cy.log('Paso 1: Crear un nuevo presupuesto');
    cy.get('#main-nav').contains('Presupuestos').click();
    cy.get('#showFormBtn').click();
    cy.get('#presupuestoFormContainer').should('be.visible');
    
    cy.get('#presupuestoCliente').select(testData.nombre);
    cy.get('#addInsumoLineBtn').click();
    cy.get('.insumo-select').first().select(1); // Selecciona el primer insumo
    cy.get('.insumo-cantidad').first().clear().type('2');
    cy.screenshot('manual-05-presupuesto-con-insumos');

    cy.intercept('POST', '/api/presupuestos').as('createPresupuesto');
    cy.get('#presupuestoForm button[type="submit"]').click();
    cy.wait('@createPresupuesto');
    cy.screenshot('manual-06-presupuesto-creado');

    // --- AVANCE DE ESTADOS Y FACTURACIÓN ---
    cy.log('Paso 2: Avanzar el presupuesto por sus estados');
    cy.get('#presupuestosTableBody > tr').first().find('td:first-child').invoke('text').as('presupuestoId');

    cy.get('@presupuestoId').then(id => {
      cy.intercept('PUT', `/api/presupuestos/${id}/estado`).as('updateEstado');
      cy.get(`tr[data-presupuesto-id="${id}"]`).find('.action-btn[data-action="Aprobado por Cliente"]').click();
      cy.wait('@updateEstado');
      cy.screenshot('manual-07-presupuesto-aprobado');

      cy.get(`tr[data-presupuesto-id="${id}"]`).find('.action-btn[data-action="En Ejecución"]').click();
      cy.wait('@updateEstado');
      cy.screenshot('manual-08-presupuesto-en-ejecucion');
      
      cy.intercept('POST', '/api/facturacion').as('createFactura');
      cy.get(`tr[data-presupuesto-id="${id}"]`).find('.action-btn[data-action="Facturar"]').click();
      cy.get('#facturacionModal').should('be.visible');
      cy.screenshot('manual-09-modal-facturacion');
      
      cy.get('#facturacionForm button[type="submit"]').click();
      cy.wait('@createFactura');
      cy.screenshot('manual-10-presupuesto-facturado-interno');
      
      cy.intercept('POST', `/api/facturacion/presupuesto/${id}/emitir-fiscal`).as('emitirFiscal');
      cy.get(`tr[data-presupuesto-id="${id}"]`).find('.action-btn[data-action="Emitir Fiscal"]').click();
      cy.wait('@emitirFiscal');
      cy.screenshot('manual-11-presupuesto-facturado-fiscal');
    });
  });
});
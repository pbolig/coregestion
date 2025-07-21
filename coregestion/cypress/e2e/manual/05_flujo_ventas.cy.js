// cypress/e2e/manual/05_flujo_ventas.cy.js

describe('Manual de Usuario - Flujo de Ventas Completo', () => {

  let testData;

  before(() => {
    // Creamos un prospecto de prueba para este flujo
    const timestamp = Date.now();
    testData = {
      nombre: `Cliente de Venta ${timestamp}`,
      email: `venta.${timestamp}@test.com`,
      password: 'password123',
      empresa: 'Constructora del Futuro'
    };
    cy.request('POST', 'http://localhost:3000/api/public/register', testData);
  });

  it('Debería documentar el proceso desde Prospecto hasta la Factura y Cobranza', () => {
    
    // --- LOGIN ---
    cy.visit('/');
    cy.get('#goToInternalLoginBtn').click();
    cy.get('#username').type('admin');
    cy.get('#password').type('admin123');
    cy.get('#loginForm button[type="submit"]').click();
    cy.get('#dashboardView').should('be.visible');
    cy.screenshot('manual-01-dashboard-principal');

    // --- APROBACIÓN DE PROSPECTO ---
    cy.get('#main-nav').contains('Prospectos').click();
    cy.get('#prospectosTableBody').contains('td', testData.email).parent('tr').find('.approve-btn').click();
    cy.get('.notification-area').should('be.visible');
    cy.screenshot('manual-02-prospecto-aprobado');

    // --- CREACIÓN DE PRESUPUESTO ---
    cy.get('#main-nav').contains('Presupuestos').click();
    cy.get('#showFormBtn').click();
    cy.get('#presupuestoFormContainer').should('be.visible');
    cy.get('#presupuestoCliente').select(testData.nombre);
    cy.get('.insumo-select').first().select(1); // ID del Generador Diesel
    cy.get('.insumo-cantidad').first().clear().type('1');
    cy.screenshot('manual-03-creacion-presupuesto');
    
    cy.intercept('POST', '/api/presupuestos').as('createPresupuesto');
    cy.get('#presupuestoForm button[type="submit"]').click();
    cy.wait('@createPresupuesto');
    cy.screenshot('manual-04-presupuesto-creado');

    // --- AVANCE DE ESTADOS Y FACTURACIÓN ---
    cy.get('#presupuestosTableBody > tr').first().find('td:first-child').invoke('text').as('presupuestoId');
    cy.get('@presupuestoId').then(id => {
      cy.intercept('PUT', `/api/presupuestos/${id}/estado`).as('updateEstado');
      cy.get(`tr[data-presupuesto-id="${id}"]`).find('.action-btn[data-action="Aprobado por Cliente"]').click();
      cy.wait('@updateEstado');
      cy.get(`tr[data-presupuesto-id="${id}"]`).find('.action-btn[data-action="En Ejecución"]').click();
      cy.wait('@updateEstado');
      
      cy.intercept('POST', '/api/facturacion').as('createFactura');
      cy.get(`tr[data-presupuesto-id="${id}"]`).find('.action-btn[data-action="Facturar"]').click();
      cy.get('#facturacionModal').should('be.visible');
      cy.get('#facturacionForm button[type="submit"]').click();
      cy.wait('@createFactura');
      cy.screenshot('manual-05-factura-interna-generada');
      
      cy.intercept('POST', `/api/facturacion/presupuesto/${id}/emitir-fiscal`).as('emitirFiscal');
      cy.get(`tr[data-presupuesto-id="${id}"]`).find('.action-btn[data-action="Emitir Fiscal"]').click();
      cy.wait('@emitirFiscal');
      cy.screenshot('manual-06-factura-fiscal-emitida');
    });

    // --- CUENTA CORRIENTE Y COBRANZA ---
    cy.get('#main-nav').contains('Cuentas C.').click();
    cy.get('#clientSelector').select(testData.nombre);
    cy.get('#pendingInvoicesTableBody').should('not.contain.text', 'Cargando...');
    cy.screenshot('manual-07-cuenta-corriente-deuda');

    cy.get('#showMovementModalBtn').click();
    cy.get('#movementModal').should('be.visible');
    cy.get('#movementConcepto').select('Pago de Cliente');
    cy.get('.application-input').first().type('50000');
    cy.screenshot('manual-08-registro-pago');
    
    cy.intercept('POST', '/api/cuentas-corrientes').as('createPayment');
    cy.get('#newMovementForm button[type="submit"]').click();
    cy.wait('@createPayment');
    cy.screenshot('manual-09-pago-aplicado');
  });
});
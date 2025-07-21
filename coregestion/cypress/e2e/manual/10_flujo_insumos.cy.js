// cypress/e2e/manual/10_flujo_cuentas_corrientes.cy.js

describe('Manual de Usuario - Flujo de Cuentas Corrientes', () => {

  let testData;

  // Antes de empezar, creamos un cliente y una factura con deuda vía API.
  before(() => {
    const timestamp = Date.now();
    testData = {
      cliente: {
        nombre: `Cliente C/C ${timestamp}`,
        email: `cc.${timestamp}@test.com`,
        cuit: `30-${timestamp.toString().slice(-8)}-${timestamp.toString().slice(-1)}`
      },
      presupuesto: {
        total: 200000, // Un monto redondo para el ejemplo
        estado: 'En Ejecución'
      }
    };

    cy.request('POST', 'http://localhost:3000/api/auth/login', { username: 'admin', password: 'admin123' })
      .then(authResponse => {
        const token = authResponse.body.token;
        // 1. Creamos el cliente
        cy.request({
          method: 'POST',
          url: 'http://localhost:3000/api/clientes',
          headers: { 'Authorization': `Bearer ${token}` },
          body: testData.cliente
        }).then(clienteResponse => {
          const clienteId = clienteResponse.body.id;
          // 2. Creamos un presupuesto para ese cliente
          cy.request({
            method: 'POST',
            url: 'http://localhost:3000/api/presupuestos',
            headers: { 'Authorization': `Bearer ${token}` },
            body: { ...testData.presupuesto, cliente_id: clienteId, fecha: new Date().toISOString(), insumos: [{insumo_id: 1, cantidad: 1}] }
          }).then(presupuestoResponse => {
            const presupuestoId = presupuestoResponse.body.id;
            // 3. Facturamos ese presupuesto para generar la deuda
            cy.request({
              method: 'POST',
              url: 'http://localhost:3000/api/facturacion',
              headers: { 'Authorization': `Bearer ${token}` },
              body: { presupuesto_id: presupuestoId }
            });
          });
        });
      });
  });

  it('Debería documentar la visualización y el registro de un pago', () => {
    
    // --- LOGIN ---
    cy.visit('/');
    cy.get('#goToInternalLoginBtn').click();
    cy.get('#username').type('admin');
    cy.get('#password').type('admin123');
    cy.get('#loginForm button[type="submit"]').click();
    cy.get('#dashboardView').should('be.visible');

    // --- NAVEGACIÓN Y VISUALIZACIÓN DE DEUDA ---
    cy.log('Paso 1: Navegar a Cuentas Corrientes y seleccionar cliente');
    cy.get('#main-nav').contains('Cuentas C.').click();
    cy.get('#clientSelector').should('be.visible');
    cy.screenshot('manual-39-vista-cc-inicial', { capture: 'viewport' });

    cy.get('#clientSelector').select(testData.cliente.nombre);
    cy.get('#pendingInvoicesTableBody').should('not.contain.text', 'Cargando...');
    cy.screenshot('manual-40-cc-con-deuda-pendiente', { capture: 'viewport' });

    // --- REGISTRO DE PAGO ---
    cy.log('Paso 2: Registrar un nuevo pago');
    cy.get('#showMovementModalBtn').click();
    cy.get('#movementModal').should('be.visible');
    cy.get('#movementConcepto').select('Pago de Cliente');
    
    // Aplicamos un pago parcial
    cy.get('.application-input').first().type('75000');
    cy.screenshot('manual-41-modal-registro-pago', { capture: 'viewport' });
    
    cy.intercept('POST', '/api/cuentas-corrientes').as('createPayment');
    cy.get('#newMovementForm button[type="submit"]').click();
    cy.wait('@createPayment');
    
    cy.get('.notification-area').should('be.visible');
    cy.get('#movementsHistoryTableBody').contains('td', 'Pago de Cliente').should('be.visible');
    cy.screenshot('manual-42-cc-con-pago-registrado', { capture: 'viewport' });
  });
});
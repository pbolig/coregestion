// cypress/e2e/manual/03_flujo_cobranza.cy.js

describe('Manual de Usuario - Flujo de Cobranza', () => {

  let testData;

  // Antes de empezar, creamos un cliente y una factura con deuda vía API.
  before(() => {
    const timestamp = Date.now();
    testData = {
      cliente: {
        nombre: `Cliente Cobranza ${timestamp}`,
        email: `cobranza.${timestamp}@test.com`,
        cuit: `30-${timestamp.toString().slice(-8)}-${timestamp.toString().slice(-1)}`
      },
      presupuesto: {
        total: 150000,
        estado: 'En Ejecución'
      }
    };

    // 1. Nos logueamos para obtener un token
    cy.request('POST', 'http://localhost:3000/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    }).then(authResponse => {
      const token = authResponse.body.token;
      
      // 2. Creamos el cliente
      cy.request({
        method: 'POST',
        url: 'http://localhost:3000/api/clientes',
        headers: { 'Authorization': `Bearer ${token}` },
        body: testData.cliente
      }).then(clienteResponse => {
        const clienteId = clienteResponse.body.id;
        testData.cliente.id = clienteId;

        // 3. Creamos un presupuesto para ese cliente
        cy.request({
          method: 'POST',
          url: 'http://localhost:3000/api/presupuestos',
          headers: { 'Authorization': `Bearer ${token}` },
          body: { ...testData.presupuesto, cliente_id: clienteId, fecha: new Date().toISOString(), insumos: [{insumo_id: 1, cantidad: 1}] }
        }).then(presupuestoResponse => {
          const presupuestoId = presupuestoResponse.body.id;

          // 4. Facturamos ese presupuesto para generar la deuda
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

  it('Debería documentar el registro y aplicación de un pago', () => {
    
    // --- LOGIN ---
    cy.visit('/');
    cy.get('#goToInternalLoginBtn').click();
    cy.get('#username').type('admin');
    cy.get('#password').type('admin123');
    cy.get('#loginForm button[type="submit"]').click();
    cy.get('#dashboardView').should('be.visible');

    // --- VERIFICACIÓN DE DEUDA ---
    cy.log('Paso 1: Verificar la deuda en la Cuenta Corriente');
    cy.get('#main-nav').contains('Cuentas C.').click();
    cy.get('#clientSelector').select(testData.cliente.nombre);
    cy.get('#pendingInvoicesTableBody').should('not.contain.text', 'Cargando...');
    cy.screenshot('manual-11-cuenta-corriente-con-deuda', { capture: 'viewport' });

    // --- REGISTRO DE PAGO ---
    cy.log('Paso 2: Registrar un pago parcial');
    cy.get('#showMovementModalBtn').click();
    cy.get('#movementModal').should('be.visible');
    cy.get('#movementConcepto').select('Pago de Cliente');
    
    // Aplicamos un pago parcial
    cy.get('.application-input').first().type('50000');
    cy.screenshot('manual-12-registro-pago-parcial', { capture: 'viewport' });
    
    cy.intercept('POST', '/api/cuentas-corrientes').as('createPayment');
    cy.get('#newMovementForm button[type="submit"]').click();
    cy.wait('@createPayment');
    
    cy.get('.notification-area').should('be.visible');
    cy.screenshot('manual-13-saldo-actualizado', { capture: 'viewport' });

    // Verificamos el historial
    cy.get('#movementsHistoryTableBody').contains('td', 'Pago de Cliente').should('be.visible');
    cy.screenshot('manual-14-historial-con-pago', { capture: 'fullPage' });
  });
});
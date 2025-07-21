// cypress/e2e/manual/07_flujo_compras.cy.js

describe('Manual de Usuario - Flujo de Compras y Stock', () => {

  let testData;
  let initialStock;

  before(() => {
    const timestamp = Date.now();
    testData = {
      nombre: `Proveedor Cypress ${timestamp}`,
      cuit: `30-${timestamp.toString().slice(-7)}-${timestamp.toString().slice(-1)}`
    };
    cy.request('POST', 'http://localhost:3000/api/auth/login', { username: 'admin', password: 'admin123' })
      .then(response => {
        cy.request({
          method: 'POST',
          url: 'http://localhost:3000/api/proveedores',
          headers: { 'Authorization': `Bearer ${response.body.token}` },
          body: testData
        });
      });
  });

  it('Debería documentar el registro de una compra y la actualización de stock', () => {
    cy.visit('/');
    cy.get('#goToInternalLoginBtn').click();
    cy.get('#username').type('admin');
    cy.get('#password').type('admin123');
    cy.get('#loginForm button[type="submit"]').click();
    cy.get('#dashboardView').should('be.visible');

    cy.log('Paso 1: Verificar stock inicial');
    cy.get('#main-nav').contains('Insumos').click();
    cy.get('#insumosTableBody').contains('td', 'Cable Subterráneo')
      .parent('tr').find('td:nth-child(4)')
      .invoke('text').then(parseInt).as('initialStock');

    cy.log('Paso 2: Crear una nueva orden de compra');
    cy.get('#main-nav').contains('Compras').click();
    cy.get('#showCompraFormBtn').click();
    cy.get('#compraFormContainer').should('be.visible');
    
    cy.get('#compraProveedor').select(testData.nombre);
    cy.get('#compraFecha').type('2025-07-08');
    cy.get('#addCompraItemBtn').click();
    cy.get('#compraItemsContainer select').first().select('2'); // Cable Subterráneo
    cy.get('.compra-quantity').first().clear().type('150');
    cy.get('.compra-price').first().clear().type('1200.00');
    cy.screenshot('manual-26-compra-con-insumo');

    cy.intercept('POST', '/api/compras').as('createCompra');
    cy.get('#compraForm button[type="submit"]').click();
    cy.wait('@createCompra');
    cy.screenshot('manual-27-compra-registrada');

    cy.log('Paso 3: Verificar la actualización de stock');
    cy.get('#main-nav').contains('Insumos').click();
    
    cy.get('@initialStock').then(stockInicial => {
      const stockEsperado = stockInicial + 150;
      cy.get('#insumosTableBody').contains('td', 'Cable Subterráneo')
        .parent('tr').find('td:nth-child(4)')
        .should('have.text', stockEsperado);
    });
    cy.screenshot('manual-28-stock-actualizado');
  });
});
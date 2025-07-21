// cypress/e2e/manual/06_flujo_abonos.cy.js

describe('Manual de Usuario - Flujo de Abonos', () => {

  let testData;

  before(() => {
    const timestamp = Date.now();
    testData = {
      nombre: `Cliente Abono ${timestamp}`,
      email: `abono.${timestamp}@test.com`,
      cuit: `30-${timestamp.toString().slice(-8)}-${timestamp.toString().slice(-1)}`
    };
    cy.request('POST', 'http://localhost:3000/api/auth/login', { username: 'admin', password: 'admin123' })
      .then(response => {
        cy.request({
          method: 'POST',
          url: 'http://localhost:3000/api/clientes',
          headers: { 'Authorization': `Bearer ${response.body.token}` },
          body: testData
        });
      });
  });

  it('Debería documentar la activación y gestión de un abono', () => {
    cy.visit('/');
    cy.get('#goToInternalLoginBtn').click();
    cy.get('#username').type('admin');
    cy.get('#password').type('admin123');
    cy.get('#loginForm button[type="submit"]').click();
    cy.get('#dashboardView').should('be.visible');

    cy.log('Paso 1: Crear presupuesto con servicio recurrente');
    cy.get('#main-nav').contains('Presupuestos').click();
    cy.get('#showFormBtn').click();
    cy.get('#presupuestoFormContainer').should('be.visible');
    
    cy.get('#presupuestoCliente').select(testData.nombre);
    cy.get('.insumo-select').first().select('5'); // ID del "Abono Mantenimiento Básico"
    cy.get('.insumo-cantidad').first().clear().type('1');
    cy.screenshot('manual-15-presupuesto-con-abono');
    
    cy.intercept('POST', '/api/presupuestos').as('createPresupuesto');
    cy.get('#presupuestoForm button[type="submit"]').click();
    cy.wait('@createPresupuesto');

    cy.log('Paso 2: Facturar para activar el abono');
    cy.get('#presupuestosTableBody > tr').first().find('.action-btn[data-action="Aprobado por Cliente"]').click();
    cy.get('#presupuestosTableBody > tr').first().find('.action-btn[data-action="En Ejecución"]').click();
    cy.get('#presupuestosTableBody > tr').first().find('.action-btn[data-action="Facturar"]').click();
    cy.get('#facturacionForm button[type="submit"]').click();

    cy.log('Paso 3: Verificar el nuevo abono en su módulo');
    cy.get('#main-nav').contains('Abonos').click();
    cy.get('#abonosTableBody').contains('td', testData.nombre).should('be.visible');
    cy.screenshot('manual-16-modulo-abonos-con-nuevo-servicio');

    cy.log('Paso 4: Editar y cancelar el abono');
    cy.get('#abonosTableBody').contains('td', testData.nombre).parent('tr').find('.edit-btn').click();
    cy.get('#abonoEditModal').should('be.visible');
    cy.screenshot('manual-17-modal-edicion-abono');

    cy.get('#abonoEstado').select('Cancelado');
    cy.get('#abonoEditForm button[type="submit"]').click();
    cy.get('.notification-area').should('contain.text', 'actualizado exitosamente');
    cy.screenshot('manual-18-abono-cancelado');
  });
});
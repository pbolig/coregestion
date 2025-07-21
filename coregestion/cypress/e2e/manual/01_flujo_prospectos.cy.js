// cypress/e2e/manual/01_flujo_prospectos.cy.js
describe('Manual de Usuario - Flujo de Prospectos', () => {
  let testData;
  before(() => {
    const ts = Date.now();
    testData = {
      nombre: `Prospecto Manual ${ts}`,
      email: `manual.${ts}@test.com`,
      password: 'password123'
    };
    cy.request('POST', 'http://localhost:3000/api/public/register', testData);
  });

  it('Debería documentar la aprobación de un prospecto', () => {
    cy.visit('/');
    cy.get('#goToInternalLoginBtn').click();
    cy.get('#username').type('admin');
    cy.get('#password').type('admin123');
    cy.get('#loginForm button[type="submit"]').click();
    cy.get('#dashboardView').should('be.visible');
    cy.screenshot('manual-01-dashboard-principal');

    cy.get('#main-nav').contains('Prospectos').click();
    cy.get('#prospectosTableBody').contains('td', testData.email).should('be.visible');
    cy.screenshot('manual-02-vista-prospectos');

    cy.get('#prospectosTableBody').contains('td', testData.email).parent('tr').find('.approve-btn').click();
    cy.get('.notification-area').should('be.visible');
    cy.screenshot('manual-03-prospecto-aprobado');
  });
});
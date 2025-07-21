// cypress/e2e/manual/04_flujo_reportes.cy.js

describe('Manual de Usuario - Flujo de Reportes', () => {

  beforeEach(() => {
    // Antes de cada prueba, iniciamos sesión para tener un token válido.
    cy.visit('/');
    cy.get('#goToInternalLoginBtn').click();
    cy.get('#username').type('admin');
    cy.get('#password').type('admin123');
    cy.get('#loginForm button[type="submit"]').click();
    cy.get('#dashboardView').should('be.visible');
  });

  it('Debería generar y documentar los reportes principales', () => {
    
    cy.log('Paso 1: Navegar al módulo de Reportes');
    cy.get('#main-nav').contains('Reportes').click();
    cy.get('#reportSelector').should('be.visible');
    cy.screenshot('manual-19-vista-reportes-inicial', { capture: 'viewport' });

    // --- Reporte de Ventas por Cliente ---
    cy.log('Paso 2: Generar Reporte de Ventas por Cliente');
    cy.intercept('GET', '/api/reportes*').as('getReporte');
    cy.get('#reportSelector').select('ventas_por_cliente');
    cy.get('#generateReportBtn').click();
    
    // Esperamos a que la API responda y la tabla tenga contenido
    cy.wait('@getReporte');
    cy.get('#reportTableFoot').should('be.visible'); // Esperamos a que aparezca el footer con los totales
    cy.screenshot('manual-20-reporte-ventas-por-cliente', { capture: 'viewport' });

    // --- Reporte de Cuentas por Cobrar ---
    cy.log('Paso 3: Generar Reporte de Cuentas por Cobrar');
    cy.get('#reportSelector').select('cuentas_por_cobrar');
    cy.get('#generateReportBtn').click();
    
    cy.wait('@getReporte');
    cy.get('#reportTableFoot').should('be.visible');
    cy.screenshot('manual-21-reporte-cuentas-por-cobrar', { capture: 'viewport' });

    // --- Reporte de Estado de Presupuestos ---
    cy.log('Paso 4: Generar Reporte de Estado de Presupuestos');
    cy.get('#reportSelector').select('estado_presupuestos');
    
    // Esperamos a que aparezca el filtro de estado y lo seleccionamos
    cy.get('#filterEstado').should('be.visible').select('Facturado');
    cy.screenshot('manual-22-reporte-presupuestos-con-filtro', { capture: 'viewport' });

    cy.get('#generateReportBtn').click();
    
    cy.wait('@getReporte');
    cy.get('#reportTableFoot').should('be.visible');
    cy.screenshot('manual-23-reporte-presupuestos-resultado', { capture: 'viewport' });
  });
});
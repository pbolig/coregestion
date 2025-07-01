// backend/services/pdfService.js
const PDFDocument = require('pdfkit');

/**
 * Genera una factura/remito en formato PDF en la memoria del servidor.
 * @param {object} data - Un objeto con toda la información para el documento.
 * @returns {Promise<Buffer>} - Una promesa que resuelve a un buffer con los datos del PDF.
 */
function crearFacturaPDF(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // --- Contenido del PDF ---
            generateHeader(doc);
            generateCustomerInformation(doc, data.cliente, data.factura);
            generateInvoiceTable(doc, data.presupuesto, data.gastosAdicionales);
            generateFooter(doc);

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

function generateHeader(doc) {
    doc.fillColor('#444444').fontSize(20).text('CoreGestión S.A.', 50, 57)
        .fontSize(10).text('Dirección de tu Empresa', 200, 65, { align: 'right' })
        .text('Ciudad, Provincia, CP', 200, 80, { align: 'right' }).moveDown();
}

function generateCustomerInformation(doc, cliente, factura) {
    let tipoComprobante = 'Remito / Ppto. Facturado';
    let numeroComprobante = `${String(factura.punto_venta || '00000').padStart(5, '0')}-${String(factura.numero_comprobante || '0').padStart(8, '0')}`;
    let fechaComprobante = new Date(factura.fecha_emision);

    if (factura.numero_comprobante_fiscal) {
        tipoComprobante = 'FACTURA';
        numeroComprobante = `${String(factura.punto_venta_fiscal).padStart(5, '0')}-${String(factura.numero_comprobante_fiscal).padStart(8, '0')}`;
        fechaComprobante = new Date(factura.fecha_emision_fiscal);
    }
    doc.fillColor('#444444').fontSize(20).text(tipoComprobante, 50, 160);
    generateHr(doc, 185);
    const customerInfoTop = 200;
    doc.fontSize(10)
        .text('Comprobante N°:', 50, customerInfoTop).font('Helvetica-Bold').text(numeroComprobante, 150, customerInfoTop)
        .font('Helvetica').text('Fecha de Emisión:', 50, customerInfoTop + 15).text(fechaComprobante.toLocaleDateString('es-AR'), 150, customerInfoTop + 15)
        .text('Saldo Pendiente:', 50, customerInfoTop + 30).text(`$${factura.saldo_pendiente.toFixed(2)}`, 150, customerInfoTop + 30)
        .font('Helvetica-Bold').text(cliente.nombre, 300, customerInfoTop)
        .font('Helvetica').text(cliente.direccion || '', 300, customerInfoTop + 15)
        .text(`${cliente.email || ''}`, 300, customerInfoTop + 30).moveDown();
    generateHr(doc, 252);
}

function generateInvoiceTable(doc, presupuesto, gastos) {
    const invoiceTableTop = 330;
    
    doc.font('Helvetica-Bold');
    generateTableRow(doc, invoiceTableTop, 'Concepto', 'Costo Unitario', 'Cantidad', 'Total');
    generateHr(doc, invoiceTableTop + 20);
    doc.font('Helvetica');

    let position = invoiceTableTop + 30;
    
    // --- CORRECCIÓN: Nos aseguramos de que presupuesto.insumos exista antes de iterar ---
    if (presupuesto && presupuesto.insumos && presupuesto.insumos.length > 0) {
        presupuesto.insumos.forEach(item => {
            const itemTotal = (item.cantidad || 0) * (item.precio_unitario || 0);
            generateTableRow(doc, position, item.nombre, `$${(item.precio_unitario || 0).toFixed(2)}`, item.cantidad || 1, `$${itemTotal.toFixed(2)}`);
            position += 20;
        });
        generateHr(doc, position - 10);
        position += 10;
    }

    if (gastos && gastos.length > 0) {
        gastos.forEach(gasto => {
            generateTableRow(doc, position, gasto.concepto, `$${(gasto.monto || 0).toFixed(2)}`, '1', `$${(gasto.monto || 0).toFixed(2)}`);
            position += 20;
        });
        generateHr(doc, position - 10);
    }
    
    // --- CORRECCIÓN: Usamos valores por defecto (|| 0) para evitar errores con 'undefined' ---
    const subtotal = presupuesto.total || 0;
    const totalGastos = (gastos || []).reduce((sum, g) => sum + g.monto, 0);

    doc.font('Helvetica-Bold').fontSize(10)
        .text('Subtotal:', 400, position + 5, { align: 'left' })
        .text(`$${subtotal.toFixed(2)}`, 0, position + 5, { align: 'right' });

    if (gastos && gastos.length > 0) {
        position += 15;
        doc.font('Helvetica-Bold').fontSize(10)
            .text('Gastos Adicionales:', 400, position + 5, { align: 'left' })
            .text(`$${totalGastos.toFixed(2)}`, 0, position + 5, { align: 'right' });
    }
        
    doc.font('Helvetica-Bold').fontSize(12)
        .text('Total Factura:', 400, position + 25, { align: 'left' })
        .text(`$${(subtotal + totalGastos).toFixed(2)}`, 0, position + 25, { align: 'right' });
}

function generateFooter(doc) {
    generateHr(doc, 750);
    doc.fontSize(10).text('Gracias por su negocio.', 50, 765, { align: 'center', width: 500 });
}

function generateTableRow(doc, y, item, unitCost, quantity, lineTotal) {
    doc.fontSize(10)
        .text(item, 50, y, {width: 230, ellipsis: true})
        .text(unitCost, 280, y, { width: 90, align: 'right' })
        .text(quantity, 370, y, { width: 90, align: 'right' })
        .text(lineTotal, 0, y, { align: 'right' });
}

function generateHr(doc, y) {
    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
}

module.exports = { crearFacturaPDF };
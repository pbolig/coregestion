// frontend/js/app.js
const userRole = localStorage.getItem('userRole');
const token = localStorage.getItem('token');
const appContent = document.getElementById('appContent');
const mainNav = document.getElementById('mainNav');
const logoutButton = document.getElementById('logoutButton');

// Módulos disponibles y sus roles de acceso
const modules = {
    'presupuestos': {
        name: 'Presupuestos',
        roles: ['admin', 'ventas'],
        path: 'js/modules/presupuestos.js'
    },
    'insumos': {
        name: 'Gestión de Insumos',
        roles: ['admin', 'almacen'],
        path: 'js/modules/insumos.js'
    },
    'clientes': {
        name: 'Gestión de Clientes',
        roles: ['admin', 'ventas', 'cobranzas'],
        path: 'js/modules/clientes.js'
    },
    'cuentas-corrientes': {
        name: 'Cuentas Corrientes',
        roles: ['admin', 'cobranzas'],
        path: 'js/modules/cuentas-corrientes.js'
    }
};

// Redirigir si no hay token o rol
if (!token || !userRole) {
    window.location.href = 'index.html'; // No es /index.html si el server está sirviendo estáticos desde la raíz
}

// Renderizar navegación según el rol
function renderNavigation() {
    mainNav.innerHTML = '';
    for (const key in modules) {
        if (modules[key].roles.includes(userRole)) {
            const navItem = document.createElement('a');
            navItem.href = '#';
            navItem.textContent = modules[key].name;
            navItem.onclick = () => loadModule(key);
            mainNav.appendChild(navItem);
        }
    }
}

// Cargar módulo
async function loadModule(moduleName) {
    const moduleInfo = modules[moduleName];
    console.log('Cargando módulo:', moduleName);
    if (!moduleInfo || !moduleInfo.roles.includes(userRole)) {
        appContent.innerHTML = '<p>Acceso denegado a este módulo.</p>';
        return;
    }

    try {
        // Importar dinámicamente el módulo JS
        const module = await import(`./modules/${moduleName}.js`);
        console.log('Módulo cargado:', module); 
        // Ejecutar una función de inicialización del módulo si existe
        if (module.render) {
            module.render(appContent); // Pasar el contenedor donde renderizar
        } else {
            appContent.innerHTML = `<h2>${moduleInfo.name}</h2><p>Contenido del módulo en desarrollo.</p>`;
        }
    } catch (error) {
        // Esta es la línea donde el error está apareciendo ahora
        console.error(`Error cargando el módulo ${moduleName}:`, error);
        appContent.innerHTML = `<p>Error al cargar el módulo ${moduleName}.</p>`;
    }
}

// Lógica de logout
logoutButton.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = 'index.html'; // No es /index.html si el server está sirviendo estáticos desde la raíz
});

// Inicializar
renderNavigation();
// Cargar un módulo por defecto al iniciar (ej. Clientes)
loadModule('clientes');
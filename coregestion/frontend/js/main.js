// frontend/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    
    // Selectores de Vistas
    const internalLoginView = document.getElementById('internalLoginView');
    const dashboardView = document.getElementById('dashboardView');
    const mainNav = document.getElementById('main-nav');
    const contentArea = document.getElementById('content-area');
    const logoutBtn = document.getElementById('logoutButton');

    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (token && user) {
        showDashboard();
    }
    // Si no hay token, portal.js se encarga de mostrar la vista de bienvenida.

    function showDashboard() {
        // Ocultar todas las vistas del portal y mostrar solo el dashboard interno
        ['welcomeView', 'internalLoginView', 'portalLoginView', 'portalRegisterView', 'portalDashboardView'].forEach(id => {
            const view = document.getElementById(id);
            if (view) view.style.display = 'none';
        });
        
        if (dashboardView) {
            dashboardView.style.display = 'block';
            const user = JSON.parse(localStorage.getItem('user'));
            buildNavbar(user.roles);
            loadWelcomeView(user.username);
            if (logoutBtn) {
                logoutBtn.addEventListener('click', window.logout);
            }
        }
    }

    function buildNavbar(userRoles) {
        mainNav.innerHTML = ''; 

        const allModules = {
            'prospectos': { title: 'Prospectos', icon: '📥', requiredRole: ['admin', 'ventas'] },
            'clientes': { title: 'Clientes', icon: '👤', requiredRole: ['admin', 'ventas', 'cobranzas'] },
            'proveedores': { title: 'Proveedores', icon: '🚚', requiredRole: ['admin', 'almacen', 'compras'] },
            'insumos': { title: 'Insumos', icon: '📦', requiredRole: ['admin', 'almacen', 'ventas'] },
            'presupuestos': { title: 'Presupuestos', icon: '📝', requiredRole: ['admin', 'ventas'] },
            'compras': { title: 'Compras', icon: '🛒', requiredRole: ['admin', 'compras', 'almacen'] },
            'cuentas-corrientes': { title: 'Cuentas C.', icon: '💳', requiredRole: ['admin', 'cobranzas'] },
            'abonos': { title: 'Abonos', icon: '🔄', requiredRole: ['admin', 'cobranzas'] },
            'reportes': { title: 'Reportes', icon: '📊', requiredRole: ['admin', 'cobranzas', 'ventas'] },
            'usuarios': { title: 'Usuarios', icon: '👥', requiredRole: ['admin'] },
            'roles': { title: 'Roles', icon: '⚙️', requiredRole: ['admin'] }
        };

        if (!Array.isArray(userRoles)) return;

        for (const moduleId in allModules) {
            const moduleInfo = allModules[moduleId];
            const hasPermission = userRoles.some(userRole => moduleInfo.requiredRole.includes(userRole));
            
            if (hasPermission) {
                const link = document.createElement('a');
                link.href = `#/${moduleId}`;
                link.textContent = `${moduleInfo.icon} ${moduleInfo.title}`;
                link.dataset.moduleId = moduleId;
                mainNav.appendChild(link);
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    navigateTo(moduleId);
                });
            }
        }
    }

    function loadWelcomeView(username) {
        contentArea.innerHTML = `
            <h2>Bienvenido, ${username}!</h2>
            <p>Selecciona un módulo en la barra de navegación superior para comenzar a trabajar.</p>
            <p>Fecha y hora actual: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</p>
        `;
    }

    /**
     * "Router" que carga módulos y les pasa parámetros.
     * @param {string} moduleId - El ID del módulo a cargar.
     * @param {object} [params={}] - Parámetros opcionales para pasar al módulo.
     */
    async function navigateTo(moduleId, params = {}) {
        contentArea.innerHTML = `<h2>Cargando módulo de ${moduleId}...</h2>`;
        try {
            const path = `./modules/${moduleId}.js`;
            const { render } = await import(path);
            // Pasamos los parámetros a la función render del módulo.
            render(contentArea, params);
        } catch (error) {
            console.error(`Error al cargar el módulo ${moduleId}:`, error);
            contentArea.innerHTML = `<h2>Error al cargar el módulo.</h2><p class="error-message">No se pudo encontrar el archivo <strong>${moduleId}.js</strong>.</p>`;
        }
    }

     // Hacemos que la función de navegación sea accesible globalmente.
    window.navigateToModule = navigateTo;
});
// frontend/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    
    const dashboardView = document.getElementById('dashboardView');
    const mainNav = document.getElementById('main-nav');
    const contentArea = document.getElementById('content-area');
    const logoutBtn = document.getElementById('logoutButton');

    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (token && user) {
        showDashboard();
    }

    function showDashboard() {
        ['welcomeView', 'internalLoginView', 'portalLoginView', 'portalRegisterView', 'portalDashboardView'].forEach(id => {
            const view = document.getElementById(id);
            if (view) view.style.display = 'none';
        });
        
        if (dashboardView) {
            dashboardView.style.display = 'block';
            const user = JSON.parse(localStorage.getItem('user'));
            buildNavbar(user.roles);
            navigateTo('dashboard');
            
            if (logoutBtn) {
                // --- CORRECCIÓN DEFINITIVA ---
                // Envolvemos la llamada en una función anónima para evitar pasar el objeto del evento.
                logoutBtn.addEventListener('click', () => window.logout());
            }
        }
    }

    /**
     * Construye la barra de navegación con menús desplegables.
     * @param {string[]} userRoles - Los roles del usuario actual.
     */
    function buildNavbar(userRoles) {
        const mainNav = document.getElementById('main-nav');
        mainNav.innerHTML = ''; 
        if (!Array.isArray(userRoles)) return;

        const navStructure = {
            'dashboard': { title: 'Dashboard', icon: '🏠', requiredRole: ['admin', 'ventas', 'cobranzas'], type: 'link' },
            'comercial': {
                title: 'Comercial', icon: '📈', type: 'dropdown', modules: [
                    { id: 'prospectos', title: 'Prospectos', requiredRole: ['admin', 'ventas'] },
                    { id: 'clientes', title: 'Clientes', requiredRole: ['admin', 'ventas', 'cobranzas'] },
                    { id: 'presupuestos', title: 'Presupuestos', requiredRole: ['admin', 'ventas'] }
                ]
            },
            'operaciones': {
                title: 'Operaciones', icon: '🔧', type: 'dropdown', modules: [
                    { id: 'compras', title: 'Compras', requiredRole: ['admin', 'compras', 'almacen'] },
                    { id: 'insumos', title: 'Insumos', requiredRole: ['admin', 'almacen', 'ventas'] },
                    { id: 'proveedores', title: 'Proveedores', requiredRole: ['admin', 'almacen', 'compras'] }
                ]
            },
            'finanzas': {
                title: 'Finanzas', icon: '💰', type: 'dropdown', modules: [
                    { id: 'cuentas-corrientes', title: 'Cuentas C.', requiredRole: ['admin', 'cobranzas'] },
                    { id: 'abonos', title: 'Abonos', requiredRole: ['admin', 'cobranzas'] }
                ]
            },
            'reportes': { title: 'Reportes', icon: '📊', requiredRole: ['admin', 'cobranzas', 'ventas'], type: 'link' },
            'admin': {
                title: 'Admin', icon: '⚙️', type: 'dropdown', modules: [
                    { id: 'usuarios', title: 'Usuarios', requiredRole: ['admin'] },
                    { id: 'roles', title: 'Roles', requiredRole: ['admin'] },
                    { id: 'backup', title: 'Backups', requiredRole: ['admin'] }
                ]
            },
            'ayuda': { title: 'Ayuda', icon: '❓', type: 'link', isExternal: true, path: '/ayuda/ayuda.html', requiredRole: ['admin', 'ventas', 'cobranzas', 'almacen', 'compras'] }
        };

        for (const key in navStructure) {
            const item = navStructure[key];
            let hasPermission = false;

            if (item.type === 'link') {
                hasPermission = userRoles.some(userRole => item.requiredRole.includes(userRole));
            } else if (item.type === 'dropdown') {
                hasPermission = item.modules.some(mod => 
                    userRoles.some(userRole => mod.requiredRole.includes(userRole))
                );
            }
            
            if (hasPermission) {
                if (item.type === 'link') {
                    mainNav.appendChild(createNavLink(item, key));
                } else if (item.type === 'dropdown') {
                    mainNav.appendChild(createNavDropdown(item, userRoles));
                }
            }
        }
        setupDropdownListeners();
    }

    function createNavLink(item, moduleId) {
        const link = document.createElement('a');
        link.textContent = `${item.icon} ${item.title}`;
        if (item.isExternal) {
            link.href = item.path;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        } else {
            link.href = `#/${moduleId}`;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo(moduleId);
            });
        }
        return link;
    }

    function createNavDropdown(item, userRoles) {
        const dropdownDiv = document.createElement('div');
        dropdownDiv.className = 'nav-dropdown';

        const button = document.createElement('button');
        button.className = 'nav-dropdown-button';
        button.innerHTML = `${item.icon} ${item.title} <i class="fas fa-chevron-down chevron" style="font-size: 0.7rem;"></i>`;
        
        const menu = document.createElement('div');
        menu.className = 'dropdown-menu';

        item.modules.forEach(mod => {
            const hasModPermission = userRoles.some(userRole => mod.requiredRole.includes(userRole));
            if (hasModPermission) {
                const link = document.createElement('a');
                link.href = `#/${mod.id}`;
                link.textContent = mod.title;
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    navigateTo(mod.id);
                    menu.classList.remove('active');
                });
                menu.appendChild(link);
            }
        });
        
        if (menu.children.length > 0) {
            dropdownDiv.appendChild(button);
            dropdownDiv.appendChild(menu);
            return dropdownDiv;
        }
        return document.createDocumentFragment();
    }

    function setupDropdownListeners() {
        document.addEventListener('click', (e) => {
            const isDropdownButton = e.target.closest('.nav-dropdown-button');
            
            document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
                if (!isDropdownButton || !menu.previousElementSibling.isSameNode(isDropdownButton)) {
                    menu.classList.remove('active');
                    menu.previousElementSibling.querySelector('.chevron').style.transform = 'rotate(0deg)';
                }
            });

            if (isDropdownButton) {
                const menu = isDropdownButton.nextElementSibling;
                const chevron = isDropdownButton.querySelector('.chevron');
                menu.classList.toggle('active');
                chevron.style.transform = menu.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0deg)';
            }
        });
    }

    async function navigateTo(moduleId, params = {}) {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `<h2>Cargando módulo de ${moduleId}...</h2>`;        
        try {
            const path = `./modules/${moduleId}.js`;
            const { render } = await import(path);
            render(contentArea, params);
        } catch (error) {
            console.error(`Error al cargar el módulo ${moduleId}:`, error);
            contentArea.innerHTML = `<h2>Error al cargar el módulo.</h2><p class="error-message">No se pudo encontrar el archivo <strong>${moduleId}.js</strong>.</p>`;
        }
    }
    
    window.navigateToModule = navigateTo;
});
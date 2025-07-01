// frontend/js/portal.js
import { fetchData } from './api.js';
import { render as renderPortalDashboard } from './modules/portal_dashboard.js';

document.addEventListener('DOMContentLoaded', () => {

    const allViews = {
        welcome: document.getElementById('welcomeView'),
        internalLogin: document.getElementById('internalLoginView'),
        portalLogin: document.getElementById('portalLoginView'),
        portalRegister: document.getElementById('portalRegisterView'),
        forgotPassword: document.getElementById('forgotPasswordView'),
        resetPassword: document.getElementById('resetPasswordView'), 
        internalDashboard: document.getElementById('dashboardView'),
        portalDashboard: document.getElementById('portalDashboardView'),
    };
    
    const showView = (viewKey) => {
        for (const key in allViews) {
            if (allViews[key]) {
                allViews[key].style.display = (key === viewKey) ? 'block' : 'none';
            }
        }
    };

    const router = () => {
        const hash = window.location.hash;
        if (hash.startsWith('#/reset-password')) {
            const token = new URLSearchParams(hash.split('?')[1]).get('token');
            if (token) {
                document.getElementById('resetToken').value = token;
                showView('resetPassword');
            } else {
                window.location.hash = '';
                showView('welcome');
            }
            return;
        }

        const internalToken = localStorage.getItem('token');
        const portalToken = localStorage.getItem('portal_token');

        if (internalToken) {
            showView('internalDashboard');
        } else if (portalToken) {
            showView('portalDashboard');
            renderPortalDashboard(document.getElementById('portal-content-area'));
        } else {
            showView('welcome');
        }
    };

    function setupEventListeners() {
        document.getElementById('goToInternalLoginBtn')?.addEventListener('click', () => showView('internalLogin'));
        document.getElementById('goToPortalLoginBtn')?.addEventListener('click', () => {
            showView('portalLogin');
            initializeGoogleSignIn();
        });
        document.getElementById('backToWelcomeFromInternal')?.addEventListener('click', () => showView('welcome'));
        document.getElementById('backToWelcomeFromPortalLogin')?.addEventListener('click', () => showView('welcome'));
        document.getElementById('goToRegisterBtn')?.addEventListener('click', (e) => { e.preventDefault(); showView('portalRegister'); });
        document.getElementById('backToPortalLogin')?.addEventListener('click', (e) => { e.preventDefault(); showView('portalLogin'); });
        document.getElementById('goToForgotPasswordBtn')?.addEventListener('click', (e) => { e.preventDefault(); showView('forgotPassword'); });
        document.getElementById('backToPortalLoginFromForgot')?.addEventListener('click', (e) => { e.preventDefault(); showView('portalLogin'); });
        
        document.getElementById('portalRegisterForm')?.addEventListener('submit', handleRegisterSubmit);
        document.getElementById('portalLoginForm')?.addEventListener('submit', handlePortalLoginSubmit);
        document.getElementById('forgotPasswordForm')?.addEventListener('submit', handleForgotSubmit);
        document.getElementById('resetPasswordForm')?.addEventListener('submit', handleResetSubmit);
        
        document.getElementById('portalLogoutButton')?.addEventListener('click', () => {
            localStorage.removeItem('portal_token');
            localStorage.removeItem('portal_user');
            window.location.hash = '';
            router();
        });

        window.addEventListener('hashchange', router);
    }
    
    async function handleRegisterSubmit(e) {
        e.preventDefault();
        const errorMessageEl = document.getElementById('registerErrorMessage');
        errorMessageEl.textContent = '';
        const data = {
            nombre: document.getElementById('registerNombre').value,
            empresa: document.getElementById('registerEmpresa').value,
            email: document.getElementById('registerEmail').value,
            telefono: document.getElementById('registerTelefono').value,
            password: document.getElementById('registerPassword').value,
        };
        try {
            const result = await fetchData('public/register', { method: 'POST', body: JSON.stringify(data) });
            alert(result.message);
            showView('portalLogin');
        } catch (error) {
            errorMessageEl.textContent = error.message;
        }
    }

    async function handlePortalLoginSubmit(e) {
        e.preventDefault();
        const errorMessageEl = document.getElementById('portalErrorMessage');
        errorMessageEl.textContent = '';
        const data = {
            email: document.getElementById('portalEmail').value,
            password: document.getElementById('portalPassword').value,
        };
        try {
            const result = await fetchData('public/login', { method: 'POST', body: JSON.stringify(data) });
            localStorage.setItem('portal_token', result.token);
            localStorage.setItem('portal_user', JSON.stringify(result.prospecto));
            router();
        } catch (error) {
            errorMessageEl.textContent = error.message;
        }
    }

    async function handleForgotSubmit(e) {
        e.preventDefault();
        const email = document.getElementById('forgotEmail').value;
        const msgEl = document.getElementById('forgotMessage');
        msgEl.className = 'error-message';
        try {
            const result = await fetchData('public/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
            msgEl.style.color = 'green';
            msgEl.textContent = result.message;
        } catch (error) {
            msgEl.textContent = error.message;
        }
    }

    async function handleResetSubmit(e) {
        e.preventDefault();
        const msgEl = document.getElementById('resetMessage');
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        if (newPassword !== confirmPassword) {
            msgEl.textContent = 'Las contraseñas no coinciden.';
            return;
        }
        const data = {
            token: document.getElementById('resetToken').value,
            password: newPassword,
        };
        try {
            const result = await fetchData('public/reset-password', { method: 'POST', body: JSON.stringify(data) });
            msgEl.style.color = 'green';
            msgEl.textContent = result.message + " Redirigiendo al login...";
            setTimeout(() => {
                window.location.hash = '';
                router();
            }, 3000);
        } catch (error) {
            msgEl.textContent = error.message;
        }
    }

    function initializeGoogleSignIn() {
        const googleBtnContainer = document.getElementById('googleSignInBtn');
        if (!googleBtnContainer || googleBtnContainer.childElementCount > 0) return;
        
        if (typeof google === 'undefined') {
            console.error("La librería de Google no se ha cargado. Verifique el CSP en el backend.");
            return;
        }
        
        // --- CORRECCIÓN: Usamos el nuevo Client ID que proporcionaste. ---
        google.accounts.id.initialize({
            client_id: "330882642608-e7u9rdermb2f83m78pot0skmns5vq9g8.apps.googleusercontent.com",
            callback: handleGoogleCredentialResponse
        });

        google.accounts.id.renderButton(
            googleBtnContainer,
            { theme: "outline", size: "large", text: "signin_with", shape: "rectangular" }
        );
    }
    
    async function handleGoogleCredentialResponse(response) {
        const errorMessageEl = document.getElementById('portalErrorMessage');
        errorMessageEl.textContent = '';
        try {
            const result = await fetchData('public/google-auth', { method: 'POST', body: JSON.stringify({ token: response.credential }) });
            if (result.token) {
                localStorage.setItem('portal_token', result.token);
                localStorage.setItem('portal_user', JSON.stringify(result.prospecto));
                router();
            } else {
                alert(result.message);
            }
        } catch (error) {
            errorMessageEl.textContent = error.message;
        }
    }
    
    setupEventListeners();
    router();
});
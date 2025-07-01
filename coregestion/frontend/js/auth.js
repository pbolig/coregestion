// frontend/js/auth.js

// --- CONSTANTES Y CONFIGURACIÓN ---
// Es una buena práctica definir la URL base de la API en un solo lugar.
const API_URL = '/api'; // Como el frontend y backend se sirven desde el mismo dominio, no necesitamos http://localhost:3000

// --- ELEMENTOS DEL DOM ---
// Obtenemos referencias a los elementos del HTML con los que vamos a interactuar.
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMessageEl = document.getElementById('errorMessage');

// --- EVENT LISTENER PARA EL LOGIN ---
// Escuchamos el evento 'submit' del formulario de login.
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        // Prevenimos el comportamiento por defecto del formulario (que es recargar la página).
        event.preventDefault();

        // Limpiamos cualquier mensaje de error anterior.
        errorMessageEl.textContent = '';

        // Obtenemos los valores de los campos de entrada.
        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            // Realizamos la petición POST a la API de login del backend.
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    // Le decimos al backend que estamos enviando datos en formato JSON.
                    'Content-Type': 'application/json'
                },
                // Convertimos el objeto de JavaScript a una cadena de texto JSON.
                body: JSON.stringify({ username, password })
            });

            // Parseamos la respuesta del backend a formato JSON.
            const data = await response.json();

            // Verificamos si la respuesta fue exitosa (códigos 200-299).
            if (response.ok) {
                // --- LOGIN EXITOSO ---
                console.log('Login exitoso:', data);
                
                // Guardamos el token y la información del usuario en el localStorage del navegador.
                // Esto nos permitirá mantener la sesión del usuario.
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // Recargamos la página. El script principal (main.js) se encargará
                // de detectar que hay un token y mostrar el dashboard.
                window.location.reload();

            } else {
                // --- LOGIN FALLIDO ---
                // Si el backend devuelve un error (ej: 401 Credenciales inválidas), lo mostramos.
                errorMessageEl.textContent = data.message || 'Error al iniciar sesión.';
            }

        } catch (error) {
            // --- ERROR DE RED ---
            // Esto ocurre si no se puede conectar con el backend (ej: servidor caído).
            console.error('Error de conexión:', error);
            errorMessageEl.textContent = 'No se pudo conectar con el servidor. Inténtelo más tarde.';
        }
    });
}

// --- FUNCIÓN DE LOGOUT ---
// Esta función podrá ser llamada desde cualquier parte de la aplicación.
function logout() {
    // Limpiamos el token y los datos de usuario del localStorage.
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Recargamos la página. Al no haber token, se mostrará la vista de login.
    window.location.reload();
}

// Hacemos la función de logout accesible globalmente (o la exportaríamos en un sistema de módulos)
window.logout = logout;
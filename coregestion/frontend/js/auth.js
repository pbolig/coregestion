// frontend/js/auth.js
// frontend/js/auth.js
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    if (loginForm) {
        console.log("DEBUG: Formulario 'loginForm' encontrado. Preparando el listener."); // DEBUG 1
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("DEBUG: Evento submit del formulario disparado."); // DEBUG 2

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            console.log("DEBUG: Datos de usuario a enviar -> Username:", username, "Password:", password); // DEBUG 3

            try {
                const response = await fetch('http://localhost:3000/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                });

                console.log("DEBUG: Respuesta del fetch recibida. Status:", response.status, "StatusText:", response.statusText); // DEBUG 4

                const data = await response.json(); // Intentamos parsear la respuesta JSON

                console.log("DEBUG: Datos parseados del backend:", data); // DEBUG 5

                if (response.ok) { // response.ok es true para códigos de estado 200-299
                    console.log("DEBUG: Login exitoso. Guardando token y rol."); // DEBUG 6
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('userRole', data.role);
                    console.log("DEBUG: Redireccionando a dashboard.html...");
                    window.location.href = '/dashboard.html';
                } else {
                    console.log("DEBUG: Login fallido. Mostrando mensaje de error."); // DEBUG 8
                    errorMessage.textContent = data.message || 'Error al iniciar sesión (mensaje genérico).';
                }
            } catch (error) {
                console.error('ERROR CRÍTICO: Error en el bloque try-catch durante el fetch o el procesamiento:', error); // DEBUG 9
                errorMessage.textContent = 'Error de conexión con el servidor o problema inesperado.';
            }
        });
    } else {
        console.error("ERROR: El formulario con ID 'loginForm' NO se encontró en el DOM."); // DEBUG 0
    }
});
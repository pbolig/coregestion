// frontend/js/api.js
const API_BASE_URL = 'http://localhost:3000/api';

// ¡IMPORTANTE!: 'export' debe estar DIRECTAMENTE aquí, no dentro de ningún bloque o función
export async function fetchData(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers // Mantener otros headers si los hay
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`<span class="math-inline">\{API\_BASE\_URL\}/</span>{endpoint}`, {
        ...options,
        headers: headers,
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            // Si el token es inválido o no autorizado, redirigir al login
            localStorage.removeItem('token');
            localStorage.removeItem('userRole');
            window.location.href = '/index.html'; // Usar /index.html si el server está sirviendo estáticos desde la raíz
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error en la solicitud.');
    }

    return response.json();
}
// frontend/js/api.js
const API_BASE_URL = 'http://localhost:3000/api';

export async function fetchData(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
        method: options.method || 'GET',
        headers: headers,
        body: options.body // Solo incluye el body si es POST/PUT
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('userRole');
            window.location.href = '/index.html';
        }
        // Intenta parsear errorData como JSON, pero maneja si no lo es
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido del servidor.' }));
        throw new Error(errorData.message || 'Error en la solicitud.');
    }

    // Manejo de respuesta vacía (ej. 204 No Content)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return response.json();
    } else {
        return {}; // Devuelve un objeto vacío si no es JSON, para evitar parsear un cuerpo vacío.
    }
}
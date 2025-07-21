// frontend/js/api.js

const API_BASE_URL = '/api';

export async function fetchData(endpoint, options = {}) {
    const token = localStorage.getItem('token') || localStorage.getItem('portal_token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = { ...options, headers };

    try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`, config);

        // --- LÓGICA MEJORADA PARA MANEJAR SESIÓN EXPIRADA ---
        if (response.status === 401 || response.status === 403) {
            // Si el servidor nos rechaza, es porque el token es inválido o expiró.
            // Llamamos a la función global de logout.
            if (window.logout) {
                window.logout('Su sesión ha expirado. Por favor, inicie sesión de nuevo.');
            }
            // Detenemos la ejecución para no procesar un error.
            return Promise.reject(new Error('Sesión expirada.'));
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Error ${response.status}: ${response.statusText}` }));
            const error = new Error(errorData.message || 'Ocurrió un error desconocido.');
            error.status = response.status;
            throw error;
        }
        
        // --- LÓGICA MEJORADA PARA MANEJAR ARCHIVOS ---
        const contentType = response.headers.get("content-type");
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Ocurrió un error.');
        }
        
        if (contentType && contentType.includes("application/json")) {
            return response.json();
        } else {
            // Si no es JSON (ej. un archivo), devolvemos la respuesta como un "Blob".
            return response.blob();
        }
    } catch (error) {
        console.error(`Error en la petición a ${endpoint}:`, error);
        throw error;
    }
}
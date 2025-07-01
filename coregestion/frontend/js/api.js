// frontend/js/api.js

const API_BASE_URL = '/api';

/**
 * Función genérica y mejorada para realizar peticiones a la API.
 * Ahora puede manejar respuestas JSON y también archivos (Blobs).
 * @param {string} endpoint - El endpoint de la API.
 * @param {object} options - Opciones de configuración para fetch.
 * @returns {Promise<any>} - La respuesta de la API en el formato correcto (JSON o Blob).
 */
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

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ 
                message: `Error ${response.status}: ${response.statusText}` 
            }));
            const error = new Error(errorData.message || 'Ocurrió un error desconocido.');
            error.status = response.status;
            if (errorData.detalles) {
                error.detalles = errorData.detalles;
            }
            throw error;
        }
        
        const contentType = response.headers.get("content-type");

        // --- LÓGICA MEJORADA ---
        if (contentType && contentType.indexOf("application/json") !== -1) {
            // Si es JSON, lo parseamos como JSON.
            return await response.json();
        } else if (contentType && contentType.indexOf("application/pdf") !== -1) {
            // Si es un PDF, lo devolvemos como un "Blob" (un objeto de tipo archivo).
            return await response.blob();
        } else {
            // Para otros casos (como un DELETE exitoso que no devuelve nada),
            // devolvemos un objeto de éxito genérico.
            return { message: 'Operación exitosa sin contenido de respuesta.' };
        }

    } catch (error) {
        console.error(`Error en la petición a ${endpoint}:`, error);
        throw error;
    }
}
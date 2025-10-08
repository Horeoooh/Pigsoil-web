// API Configuration for PigSoil+ Frontend
const API_CONFIG = {
    BASE_URL: 'http://localhost:3000',
    API_BASE_URL: 'http://localhost:3000/api'
};

// Generic API call function
async function makeAPICall(endpoint, options = {}) {
    const url = API_CONFIG.API_BASE_URL + endpoint;
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    try {
        const response = await fetch(url, finalOptions);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Test connection function
async function testConnection() {
    try {
        const response = await fetch(API_CONFIG.BASE_URL + '/health');
        const data = await response.json();
        console.log('Backend connection test:', data);
        return data;
    } catch (error) {
        console.error('Backend connection failed:', error);
        return null;
    }
}

// Make functions available globally
window.API_CONFIG = API_CONFIG;
window.makeAPICall = makeAPICall;
window.testConnection = testConnection;
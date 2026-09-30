import axios from 'axios';

export const API_URL = "https://script.google.com/macros/s/AKfycby3lpNuHO8dYmAR0O98hYM7PftKbhAzsz4DuCucyAoiFN-MH3qxD8bhCGmxssJ0v76nBg/exec";

// Workaround untuk mencegah error CORS saat aplikasi diakses dari Browser Web (GitHub Pages)
axios.defaults.headers.post['Content-Type'] = 'text/plain';

// Pastikan data selalu dikirim sebagai string murni agar browser tidak memblokirnya
axios.interceptors.request.use(config => {
    if (config.method === 'post' && typeof config.data === 'object') {
        config.data = JSON.stringify(config.data);
    }
    return config;
});

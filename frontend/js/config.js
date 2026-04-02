// js/config.js

// Global Error Handling
window.onerror = function(msg, url, line) { 
    console.error("Script Error: " + msg + " (Line " + line + ")"); 
};

export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCW0rBn8YLGfYqdkj3DCn2RPUeYirIpreU",
    authDomain: "vaad-87fed.firebaseapp.com",
    projectId: "vaad-87fed",
    storageBucket: "vaad-87fed.firebasestorage.app",
    messagingSenderId: "649989985981",
    appId: "1:649989985981:web:6dcbcdd0babd45f2cb09d4",
    measurementId: "G-36J186LSR4"
};

export const GIS_CLIENT_ID = "649989985981-u00i42pgr5taercoj5koqabm5aul58k0.apps.googleusercontent.com";

export const API_URL = 'https://vaad-wnul.onrender.com/api';

export const PLAN_LIMITS = {
    free: { search: 1, pdf: 0 },
    pro: { search: 30, pdf: 0 },
    promax: { search: 100, pdf: 0 },
    supreme: { search: 150, pdf: 30 }
};

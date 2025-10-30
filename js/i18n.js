// i18next Internationalization Manager
// Handles English and Cebuano translations with localStorage persistence

const LANGUAGE_STORAGE_KEY = 'pigsoil_language_preference';
const DEFAULT_LANGUAGE = 'en';
const SUPPORTED_LANGUAGES = ['en', 'ceb'];

// Initialize i18next
async function initializeI18n() {
    // Get saved language preference or default to English
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || DEFAULT_LANGUAGE;
    
    try {
        await i18next
            .use(i18nextHttpBackend)
            .init({
                lng: savedLanguage,
                fallbackLng: 'en',
                debug: true,
                ns: 'translation',
                defaultNS: 'translation',
                backend: {
                    loadPath: '/locales/{{lng}}.json'
                }
            });
        
        console.log('🌐 i18next initialized with language:', savedLanguage);
        
        // Update the page content
        updateContent();
        
        // Update language button
        updateLanguageButton();
        
    } catch (error) {
        console.error('❌ Error initializing i18next:', error);
    }
}

// Update all content on the page
function updateContent() {
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const i18nValue = element.getAttribute('data-i18n');
        
        // Check if it's an attribute translation like [placeholder]key
        if (i18nValue.startsWith('[') && i18nValue.includes(']')) {
            const match = i18nValue.match(/\[([^\]]+)\](.+)/);
            if (match) {
                const attribute = match[1]; // e.g., "placeholder"
                const key = match[2]; // e.g., "login.emailPlaceholder"
                const translation = i18next.t(key);
                element.setAttribute(attribute, translation);
            }
        } else {
            // Regular text content translation
            const translation = i18next.t(i18nValue);
            
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        }
    });
    
    // Update elements with data-i18n-html (for HTML content with emojis)
    document.querySelectorAll('[data-i18n-html]').forEach(element => {
        const key = element.getAttribute('data-i18n-html');
        element.innerHTML = i18next.t(key);
    });
    
    console.log('✅ Page content updated with translations');
}

// Update language button text
function updateLanguageButton() {
    const currentLang = i18next.language;
    const languageBtn = document.querySelector('.language-btn');
    
    if (languageBtn) {
        const languageText = languageBtn.querySelector('.language-text');
        if (languageText) {
            languageText.textContent = i18next.t('language.current');
        }
    }
}

// Switch language between English and Cebuano
function switchLanguage() {
    const currentLang = i18next.language;
    const newLang = currentLang === 'en' ? 'ceb' : 'en';
    
    console.log(`🔄 Switching language from ${currentLang} to ${newLang}`);
    
    i18next.changeLanguage(newLang, (err) => {
        if (err) {
            console.error('❌ Error changing language:', err);
            return;
        }
        
        // Save preference to localStorage
        localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
        
        // Update all content
        updateContent();
        updateLanguageButton();
        
        console.log('✅ Language changed to:', newLang);
        
        // Dispatch event for other scripts to listen
        const event = new CustomEvent('languageChanged', {
            detail: { language: newLang }
        });
        document.dispatchEvent(event);
    });
}

// Get current language
function getCurrentLanguage() {
    return i18next.language || DEFAULT_LANGUAGE;
}

// Export functions for use in other modules
window.i18nManager = {
    initialize: initializeI18n,
    switchLanguage: switchLanguage,
    getCurrentLanguage: getCurrentLanguage,
    updateContent: updateContent
};

console.log('🌐 i18next Manager loaded');

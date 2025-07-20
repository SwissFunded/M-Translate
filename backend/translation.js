const deepl = require('deepl-node');

// Initialize DeepL client
let translator = null;

// Translation cache to avoid re-translating same text
const translationCache = new Map();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Initialize DeepL client
const initializeTranslator = () => {
  const apiKey = process.env.DEEPL_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ DeepL API key not found. Translation features will be disabled.');
    return false;
  }
  
  try {
    translator = new deepl.Translator(apiKey);
    console.log('✅ DeepL translator initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize DeepL translator:', error);
    return false;
  }
};

// Cache management
const getCacheKey = (text, targetLanguage) => {
  return `${text.toLowerCase().trim()}|${targetLanguage}`;
};

const addToCache = (key, result) => {
  // Implement LRU eviction if cache is full
  if (translationCache.size >= CACHE_MAX_SIZE) {
    const firstKey = translationCache.keys().next().value;
    translationCache.delete(firstKey);
  }
  
  translationCache.set(key, {
    ...result,
    cachedAt: Date.now()
  });
};

const getFromCache = (key) => {
  const cached = translationCache.get(key);
  if (!cached) return null;
  
  // Check if cache entry is expired
  if (Date.now() - cached.cachedAt > CACHE_TTL) {
    translationCache.delete(key);
    return null;
  }
  
  return cached;
};

// Validate DeepL API key and check usage
const validateDeepLKey = async () => {
  if (!translator) {
    return { valid: false, error: 'Translator not initialized' };
  }
  
  try {
    const usage = await translator.getUsage();
    console.log('🔑 DeepL API key is valid');
    console.log('📊 Translation usage:', {
      character_count: usage.character.count,
      character_limit: usage.character.limit,
      usage_percentage: ((usage.character.count / usage.character.limit) * 100).toFixed(2) + '%'
    });
    
    return {
      valid: true,
      usage: {
        count: usage.character.count,
        limit: usage.character.limit,
        percentage: (usage.character.count / usage.character.limit) * 100
      }
    };
  } catch (error) {
    console.error('❌ DeepL API key validation failed:', error);
    return { valid: false, error: error.message };
  }
};

// Translate text from Czech to English with caching
const translateText = async (text, targetLanguage = 'EN-US') => {
  if (!translator) {
    console.warn('⚠️ Translator not available');
    return null;
  }
  
  if (!text || text.trim().length === 0) {
    return '';
  }
  
  // Check cache first
  const cacheKey = getCacheKey(text, targetLanguage);
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log(`💾 Cache hit for: "${text}"`);
    return {
      ...cached,
      fromCache: true,
      timestamp: new Date().toISOString()
    };
  }
  
  try {
    console.log(`🔄 Translating: "${text}" (cs → ${targetLanguage})`);
    
    const result = await translator.translateText(
      text,
      'cs', // Source language: Czech
      targetLanguage, // Target language: English (US)
      {
        preserveFormatting: true,
        formality: 'default'
      }
    );
    
    const translatedText = result.text;
    console.log(`✅ Translation result: "${translatedText}"`);
    
    const translationResult = {
      originalText: text,
      translatedText: translatedText,
      sourceLanguage: 'cs',
      targetLanguage: targetLanguage,
      timestamp: new Date().toISOString(),
      fromCache: false
    };
    
    // Add to cache
    addToCache(cacheKey, translationResult);
    
    return translationResult;
  } catch (error) {
    console.error('❌ Translation failed:', error);
    return {
      originalText: text,
      translatedText: `[Translation Error: ${error.message}]`,
      sourceLanguage: 'cs',
      targetLanguage: targetLanguage,
      error: error.message,
      timestamp: new Date().toISOString(),
      fromCache: false
    };
  }
};

// Batch translate multiple texts (for optimization)
const translateBatch = async (texts, targetLanguage = 'EN-US') => {
  if (!translator) {
    console.warn('⚠️ Translator not available');
    return texts.map(text => null);
  }
  
  // Separate cached and non-cached texts
  const results = new Array(texts.length);
  const needTranslation = [];
  const translationIndices = [];
  
  texts.forEach((text, index) => {
    const cacheKey = getCacheKey(text, targetLanguage);
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      results[index] = {
        ...cached,
        fromCache: true,
        timestamp: new Date().toISOString()
      };
    } else {
      needTranslation.push(text);
      translationIndices.push(index);
    }
  });
  
  // Translate non-cached texts
  if (needTranslation.length > 0) {
    try {
      console.log(`🔄 Batch translating ${needTranslation.length} texts`);
      
      const translationResults = await translator.translateText(
        needTranslation,
        'cs',
        targetLanguage,
        {
          preserveFormatting: true,
          formality: 'default'
        }
      );
      
      translationResults.forEach((result, i) => {
        const originalText = needTranslation[i];
        const translationResult = {
          originalText: originalText,
          translatedText: result.text,
          sourceLanguage: 'cs',
          targetLanguage: targetLanguage,
          timestamp: new Date().toISOString(),
          fromCache: false
        };
        
        // Add to cache
        const cacheKey = getCacheKey(originalText, targetLanguage);
        addToCache(cacheKey, translationResult);
        
        // Store in results array
        const originalIndex = translationIndices[i];
        results[originalIndex] = translationResult;
      });
    } catch (error) {
      console.error('❌ Batch translation failed:', error);
      translationIndices.forEach((index, i) => {
        results[index] = {
          originalText: needTranslation[i],
          translatedText: `[Translation Error: ${error.message}]`,
          sourceLanguage: 'cs',
          targetLanguage: targetLanguage,
          error: error.message,
          timestamp: new Date().toISOString(),
          fromCache: false
        };
      });
    }
  }
  
  return results;
};

// Get supported languages
const getSupportedLanguages = async () => {
  if (!translator) {
    return { source: [], target: [] };
  }
  
  try {
    const sourceLanguages = await translator.getSourceLanguages();
    const targetLanguages = await translator.getTargetLanguages();
    
    return {
      source: sourceLanguages,
      target: targetLanguages
    };
  } catch (error) {
    console.error('❌ Failed to get supported languages:', error);
    return { source: [], target: [] };
  }
};

// Get cache statistics
const getCacheStats = () => {
  return {
    size: translationCache.size,
    maxSize: CACHE_MAX_SIZE,
    ttl: CACHE_TTL,
    entries: Array.from(translationCache.keys()).slice(0, 10) // First 10 entries
  };
};

// Clear cache
const clearCache = () => {
  translationCache.clear();
  console.log('🗑️ Translation cache cleared');
};

module.exports = {
  initializeTranslator,
  validateDeepLKey,
  translateText,
  translateBatch,
  getSupportedLanguages,
  getCacheStats,
  clearCache
}; 
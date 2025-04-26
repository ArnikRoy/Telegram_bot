// Load environment variables
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Get tokens from environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
const tmdbApiKey = process.env.TMDB_API_KEY;

// Debug: Check token (remove this in production)
console.log('Token length:', token ? token.length : 0);
console.log('Token first 5 chars:', token ? token.substring(0, 5) : 'none');

// Validate environment variables
if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not set in .env file');
    process.exit(1);
}

if (!tmdbApiKey) {
    console.error('TMDB_API_KEY is not set in .env file');
    process.exit(1);
}

// Initialize bot with polling
const bot = new TelegramBot(token, { polling: true });

// Add polling error handler with more detailed logging
bot.on('polling_error', (error) => {
    console.error('Polling error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
    });
    if (error.code === 'ETELEGRAM') {
        console.log('Attempting to restart polling...');
        bot.stopPolling();
        setTimeout(() => bot.startPolling(), 5000);
    }
});

// Test TMDB API connection
axios.get('https://api.themoviedb.org/3/genre/movie/list', {
    params: {
        api_key: tmdbApiKey
    }
})
.then(response => {
    console.log('TMDB API connection successful');
    console.log('Available genres:', response.data.genres);
})
.catch(error => {
    console.error('TMDB API Error:', error.message);
});

// Mood to genre mapping
const moodGenreMap = {
    'funny': { genres: [35], message: 'comedy' }, // Comedy
    'sad': { genres: [18, 10749], message: 'drama and romance' }, // Drama, Romance
    'action': { genres: [28, 12], message: 'action and adventure' }, // Action, Adventure
    'horror': { genres: [27, 53], message: 'horror and thriller' }, // Horror, Thriller
    'cartoon': { genres: [16, 14], message: 'animation and fantasy' }, // Animation, Fantasy
    'romantic': { genres: [10749], message: 'romance' } // Pure Romance
};

// Language and region mapping
const languageMap = {
    'english': { code: 'en-US', region: 'US' },
    'hindi': { code: 'hi', region: 'IN' },
    'spanish': { code: 'es', region: 'ES' },
    'french': { code: 'fr', region: 'FR' },
    'german': { code: 'de', region: 'DE' },
    'japanese': { code: 'ja', region: 'JP' },
    'korean': { code: 'ko', region: 'KR' },
    'chinese': { code: 'zh', region: 'CN' },
    'italian': { code: 'it', region: 'IT' },
    'russian': { code: 'ru', region: 'RU' },
    'portuguese': { code: 'pt', region: 'PT' },
    'turkish': { code: 'tr', region: 'TR' }
};

// Add a new object to store user's last search parameters
const userLastSearch = new Map();

// Handle /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name;
    
    const welcomeMessage = `Hello ${firstName}! 👋\n\n` +
        'Welcome to MoodMovie Bot! 🎬\n\n' +
        'Tell me your mood, and I\'ll suggest some movies and TV shows that match your feeling!\n\n' +
        'Available moods:\n' +
        '😊 funny\n' +
        '😢 sad\n' +
        '🤩 action\n' +
        '😨 horror\n' +
        '🎨 cartoon\n' +
        '❤️ romantic';

    bot.sendMessage(chatId, welcomeMessage);
});

// Handle /help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = 'How to use MoodMovie Bot:\n\n' +
        '1. Type a mood followed by language:\n' +
        '   Format: <mood> <language>\n' +
        '   Example: romantic hindi\n' +
        '   Example: funny french\n\n' +
        'Available moods:\n' +
        '   - funny\n' +
        '   - sad\n' +
        '   - action\n' +
        '   - horror\n' +
        '   - cartoon\n' +
        '   - romantic\n\n' +
        'Supported languages:\n' +
        '   - English (default)\n' +
        '   - Hindi\n' +
        '   - Spanish\n' +
        '   - French\n' +
        '   - German\n' +
        '   - Japanese\n' +
        '   - Korean\n' +
        '   - Chinese\n' +
        '   - Italian\n' +
        '   - Russian\n' +
        '   - Portuguese\n' +
        '   - Turkish\n\n' +
        'Available commands:\n' +
        '/start - Start the bot\n' +
        '/help - Show this help message';

    bot.sendMessage(chatId, helpMessage);
});

// Handle mood messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const input = msg.text.toLowerCase().split(' ');
    
    // Ignore commands
    if (input[0].startsWith('/')) {
        return;
    }

    const mood = input[0];
    const languageName = input[1] || 'english';
    
    // Store the search parameters
    userLastSearch.set(chatId, {
        mood,
        languageName,
        currentPage: 1
    });

    await sendRecommendations(chatId, mood, languageName, 1);
});

// Add a function to send recommendations
async function sendRecommendations(chatId, mood, languageName, page) {
    const languageSettings = languageMap[languageName];

    if (!languageSettings) {
        bot.sendMessage(chatId, 'Unsupported language. Please use one of the supported languages listed in /help');
        return;
    }

    if (moodGenreMap[mood]) {
        try {
            bot.sendChatAction(chatId, 'typing');
            const { genres, message } = moodGenreMap[mood];
            
            // Update API calls to use page parameter
            const movieResponse = await axios.get(`https://api.themoviedb.org/3/discover/movie`, {
                params: {
                    api_key: tmdbApiKey,
                    with_genres: genres.join(','),
                    sort_by: 'popularity.desc',
                    page: page,
                    include_adult: false,
                    language: languageSettings.code,
                    region: languageSettings.region,
                    with_original_language: languageSettings.code.split('-')[0]
                }
            });

            const tvResponse = await axios.get(`https://api.themoviedb.org/3/discover/tv`, {
                params: {
                    api_key: tmdbApiKey,
                    with_genres: genres.join(','),
                    sort_by: 'popularity.desc',
                    page: page,
                    include_adult: false,
                    language: languageSettings.code,
                    ...(languageSettings.code === 'hi' ? {
                        watch_region: 'IN',
                        with_origin_country: 'IN'
                    } : {
                        region: languageSettings.region,
                        with_original_language: languageSettings.code.split('-')[0]
                    })
                }
            });

            const movies = movieResponse.data.results.slice(0, 10);
            const tvShows = tvResponse.data.results.slice(0, 10);

            let response = `Based on your ${mood} mood, here are some ${message} suggestions in ${languageName}`;
            response += page > 1 ? ` (Page ${page}):\n\n` : ':\n\n';

            if (movies.length > 0) {
                response += '🎬 Movies:\n';
                movies.forEach(movie => {
                    const year = movie.release_date ? `(${movie.release_date.split('-')[0]})` : '';
                    const rating = movie.vote_average ? `⭐ ${movie.vote_average.toFixed(1)}` : '';
                    response += `- ${movie.title} ${year} ${rating}\n`;
                });
            }

            if (tvShows.length > 0) {
                response += '\n📺 TV Shows:\n';
                tvShows.forEach(show => {
                    const year = show.first_air_date ? `(${show.first_air_date.split('-')[0]})` : '';
                    const rating = show.vote_average ? `⭐ ${show.vote_average.toFixed(1)}` : '';
                    response += `- ${show.name} ${year} ${rating}\n`;
                });
            }

            response += '\nWant more suggestions? Try another mood and language! 😊';

            // Add inline keyboard with "More Results" button
            const inlineKeyboard = {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔄 Show More Results', callback_data: `more_${mood}_${languageName}_${page + 1}` }
                    ]]
                }
            };

            bot.sendMessage(chatId, response, inlineKeyboard);
        } catch (error) {
            console.error('API Error:', error.message);
            bot.sendMessage(chatId, '😔 Sorry, there was an error getting recommendations. Please try again later.');
        }
    } else {
        const errorMessage = 'Please enter a valid mood and language:\n\n' +
            'Format: <mood> <language>\n' +
            'Example: romantic hindi\n' +
            'Example: funny french\n\n' +
            'Available moods:\n' +
            '😊 funny\n' +
            '😢 sad\n' +
            '🤩 action\n' +
            '😨 horror\n' +
            '🎨 cartoon\n' +
            '❤️ romantic\n\n' +
            'Supported languages:\n' +
            '- English\n' +
            '- Hindi\n' +
            '- Spanish\n' +
            '- French\n' +
            '- German\n' +
            '- Japanese\n' +
            '- Korean\n' +
            '- Chinese\n' +
            '- Italian\n' +
            '- Russian\n' +
            '- Portuguese\n' +
            '- Turkish\n\n' +
            'Or use /help for more information.';
            
        bot.sendMessage(chatId, errorMessage);
    }
}

// Add callback query handler for the "More Results" button
bot.on('callback_query', async (query) => {
    const [action, mood, language, page] = query.data.split('_');
    if (action === 'more') {
        await sendRecommendations(query.message.chat.id, mood, language, parseInt(page));
        // Answer the callback query to remove the loading state
        bot.answerCallbackQuery(query.id);
    }
});

// Log that bot is running
console.log('MoodMovie Bot is running...');














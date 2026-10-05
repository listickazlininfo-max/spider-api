const express = require('express');
const Parser = require('rss-parser');
const cron = require('node-cron');
const path = require('path');

const app = express();
const parser = new Parser();
const PORT = process.env.PORT || 3000;

// RSS kanály prohledávající internet + specializované weby o školství
const RSS_SOURCES = [
    // Vyhledávač Google News pro slovo "školství" na celém českém internetu
    { name: 'Google News (Celý web)', url: 'https://news.google.com/rss/search?q=%C5%A1kolstv%C3%AD&hl=cs&gl=CZ&ceid=CZ:cs' },
    // Ministerstvo školství
    { name: 'MŠMT', url: 'https://www.msmt.cz/rss/aktuality' },
    // Eduin - Informace o vzdělávání
    { name: 'EDUin', url: 'https://www.eduin.cz/feed/' }
];

let cachedNews = [];

// Funkce pro stažení a zpracování dat
async function fetchAllEducationNews() {
    console.log('🔄 Skenuji internet a hledám nové zprávy o školství...');
    let articles = [];

    for (const source of RSS_SOURCES) {
        try {
            const feed = await parser.parseURL(source.url);
            feed.items.forEach(item => {
                articles.push({
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
                    source: source.name,
                    snippet: item.contentSnippet ? item.contentSnippet.substring(0, 160) + '...' : 'Bez popisu'
                });
            });
        } catch (err) {
            console.error(`Chyba při načítání ze zdroje ${source.name}:`, err.message);
        }
    }

    // Seřazení od nejnovějších
    articles.sort((a, b) => b.pubDate - a.pubDate);

    // Odstranění duplicit podle odkazu
    const uniqueMap = new Map();
    articles.forEach(art => uniqueMap.set(art.link, art));
    
    cachedNews = Array.from(uniqueMap.values()).slice(0, 40); // Uložíme 40 nejčerstvějších zpráv
    console.log(`✅ Aktualizováno! Načteno ${cachedNews.length} unikátních zpráv.`);
}

// Spustit hned při startu serveru
fetchAllEducationNews();

// Automatický časovač: Prohledá internet každých 30 minut
cron.schedule('*/30 * * * *', () => {
    fetchAllEducationNews();
});

// Servírovat statické soubory (stránku) ze složky 'public'
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint pro frontend webu
app.get('/api/news', (req, res) => {
    res.json({
        updatedAt: new Date().toLocaleTimeString('cs-CZ'),
        count: cachedNews.length,
        articles: cachedNews
    });
});

app.listen(PORT, () => {
    console.log(`Server běží na portu ${PORT}`);
});

const express = require('express');
const path = require('path');
const multer = require('multer');
const app = express();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public/uploads')),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// База данных в памяти
let dbData = {
    teachers: [
        { id: 1, name: "Анна Смирнова", desc: "Общий английский · Базовый уровень", avatar: "👩‍🏫" },
        { id: 2, name: "Тимур Бек", desc: "Разговорные клубы · Практика речи", avatar: "👨‍🏫" },
        { id: 3, name: "Диана Ким", desc: "IELTS · Экзаменационная подготовка", avatar: "👩🏻‍🏫" }
    ],
    certificates: [
        { id: 1, title: "Лицензия МинОбра", desc: "Официальное разрешение на образовательную деятельность." },
        { id: 2, title: "Международный стандарт", desc: "Методика соответствует мировым стандартам." }
    ],
    leads: []
};

// --- API ДЛЯ САЙТА ---
app.get('/api/teachers', (req, res) => res.json(dbData.teachers));
app.get('/api/certificates', (req, res) => res.json(dbData.certificates));

// Отправка заявки с сайта (с дублированием в чат и канал)
app.post('/api/submit', async (req, res) => {
    try {
        const { name, phone, course, level, goals } = req.body;
        const newLead = { 
            id: Date.now(), 
            name, 
            phone, 
            course, 
            level, 
            goals, 
            status: 'new', 
            date: new Date().toLocaleString('ru-RU') 
        };
        dbData.leads.unshift(newLead);

        const botToken = process.env.BOT_TOKEN;
        const chatId = process.env.CHAT_ID;
        const channelId = process.env.CHANNEL_ID;

        const message = `🚀 *Новая заявка на сайте Fast & Easy!*\n\n👤 *Имя:* ${name}\n📞 *Телефон:* ${phone}\n📚 *Курс:* ${course}\n📊 *Уровень:* ${level}\n🎯 *Цель:* ${goals || 'Не указана'}`;

        // Отправка в админ-чат
        if (botToken && chatId) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
            });
        }

        // Отправка в Telegram-канал (если задан CHANNEL_ID)
        if (botToken && channelId) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: channelId, text: message, parse_mode: 'Markdown' })
            });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// --- API ДЛЯ АДМИН-БОТА (CRUD + CRM) ---
const checkAuth = (req, res, next) => {
    if (req.body.secret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ error: 'Доступ запрещен' });
    }
    next();
};

app.post('/api/admin/leads', checkAuth, (req, res) => res.json(dbData.leads));
app.post('/api/admin/leads/status', checkAuth, (req, res) => {
    const { id, status } = req.body;
    const lead = dbData.leads.find(l => l.id == id);
    if (lead) lead.status = status;
    res.json({ success: true });
});

app.post('/api/admin/teacher', checkAuth, (req, res) => {
    const { name, desc, avatar } = req.body;
    const newT = { id: Date.now(), name, desc, avatar: avatar || '👩‍🏫' };
    dbData.teachers.push(newT);
    res.json({ success: true, item: newT });
});

app.delete('/api/admin/teacher/:id', checkAuth, (req, res) => {
    dbData.teachers = dbData.teachers.filter(t => t.id != req.params.id);
    res.json({ success: true });
});

app.post('/api/admin/cert', checkAuth, (req, res) => {
    const { title, desc } = req.body;
    const newC = { id: Date.now(), title, desc };
    dbData.certificates.push(newC);
    res.json({ success: true, item: newC });
});

app.delete('/api/admin/cert/:id', checkAuth, (req, res) => {
    dbData.certificates = dbData.certificates.filter(c => c.id != req.params.id);
    res.json({ success: true });
});

app.post('/api/admin/stats', checkAuth, (req, res) => {
    res.json({
        teachersCount: dbData.teachers.length,
        certsCount: dbData.certificates.length,
        leadsCount: dbData.leads.length,
        newLeadsCount: dbData.leads.filter(l => l.status === 'new').length
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

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
    leads: [] // Хранилище заявок с сайта
};

// --- PUBLIC API ---
app.get('/api/teachers', (req, res) => res.json(dbData.teachers));
app.get('/api/certificates', (req, res) => res.json(dbData.certificates));

// Прием заявки с сайта
app.post('/api/submit', async (req, res) => {
    try {
        const { name, phone, course, level, goals } = req.body;
        const newLead = {
            id: Date.now(),
            name, phone, course, level, goals: goals || 'Не указана',
            date: new Date().toLocaleString('ru-RU'),
            status: 'new'
        };
        
        dbData.leads.unshift(newLead); // Добавляем новую заявку в начало

        // Уведомление в Telegram
        const botToken = process.env.BOT_TOKEN;
        const chatId = process.env.CHAT_ID;
        if (botToken && chatId) {
            const message = `🚀 *НОВАЯ ЗАЯВКА НА САЙТЕ!*\n\n👤 *Имя:* ${name}\n📞 *Тел:* ${phone}\n📚 *Курс:* ${course}\n📊 *Уровень:* ${level}\n🎯 *Цель:* ${newLead.goals}`;
            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
            }).catch(console.error);
        }

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// --- ADMIN API ---
function checkSecret(req, res, next) {
    if (req.body.secret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ error: 'Доступ запрещен' });
    }
    next();
}

// Преподаватели
app.post('/api/admin/teacher', checkSecret, (req, res) => {
    const { name, desc, avatar } = req.body;
    const item = { id: Date.now(), name, desc, avatar: avatar || '👩‍🏫' };
    dbData.teachers.push(item);
    res.json({ success: true, item });
});
app.delete('/api/admin/teacher/:id', checkSecret, (req, res) => {
    dbData.teachers = dbData.teachers.filter(t => t.id != req.params.id);
    res.json({ success: true });
});

// Сертификаты
app.post('/api/admin/cert', checkSecret, (req, res) => {
    const { title, desc } = req.body;
    const item = { id: Date.now(), title, desc };
    dbData.certificates.push(item);
    res.json({ success: true, item });
});
app.delete('/api/admin/cert/:id', checkSecret, (req, res) => {
    dbData.certificates = dbData.certificates.filter(c => c.id != req.params.id);
    res.json({ success: true });
});

// Заявки (Leads)
app.post('/api/admin/leads', checkSecret, (req, res) => res.json(dbData.leads));
app.post('/api/admin/lead/status', checkSecret, (req, res) => {
    const { id, status } = req.body;
    const lead = dbData.leads.find(l => l.id == id);
    if (lead) lead.status = status;
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

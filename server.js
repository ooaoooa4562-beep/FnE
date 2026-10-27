const express = require('express');
const path = require('path');
const multer = require('multer');
const app = express();

// Настройка хранилища multer для загрузки фотографий
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public/uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// База данных в памяти (преподаватели и сертификаты)
let dbData = {
    teachers: [
        { id: 1, name: "Анна Смирнова", desc: "Общий английский · Базовый уровень", avatar: "👩‍🏫" },
        { id: 2, name: "Тимур Бек", desc: "Разговорные клубы · Практика речи", avatar: "👨‍🏫" },
        { id: 3, name: "Диана Ким", desc: "IELTS · Экзаменационная подготовка", avatar: "👩🏻‍🏫" }
    ],
    certificates: [
        { id: 1, title: "Лицензия МинОбра", desc: "Официальное разрешение на образовательную деятельность." },
        { id: 2, title: "Международный стандарт", desc: "Методика соответствует мировым стандартам." }
    ]
};

// --- API ДЛЯ САЙТА ---
app.get('/api/teachers', (req, res) => res.json(dbData.teachers));
app.get('/api/certificates', (req, res) => res.json(dbData.certificates));

// Отправка заявок в Telegram
app.post('/api/submit', async (req, res) => {
    try {
        const { name, phone, course, level, goals } = req.body;
        const botToken = process.env.BOT_TOKEN;
        const chatId = process.env.CHAT_ID;

        if (!botToken || !chatId) {
            return res.status(500).json({ success: false, error: 'Токены не настроены' });
        }

        const message = `🚀 Новая заявка (Fast and Easy):\n\n👤 Имя: ${name}\n📞 Телефон: ${phone}\n📚 Курс: ${course}\n📊 Уровень: ${level}\n🎯 Цель: ${goals || 'Не указана'}`;

        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message })
        });

        const data = await response.json();
        if (!data.ok) throw new Error('Ошибка Telegram API');

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Загрузка фото
app.post('/api/upload', upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'Файл не передан' });
    res.status(200).json({ success: true, url: `/uploads/${req.file.filename}` });
});

// --- API ДЛЯ АДМИН-БОТА (CRUD) ---

// Добавить преподавателя
app.post('/api/admin/teacher', (req, res) => {
    const { secret, name, desc, avatar } = req.body;
    if (secret !== process.env.ADMIN_SECRET) return res.status(403).json({ error: 'Доступ запрещен' });
    
    const newT = { id: Date.now(), name, desc, avatar: avatar || '👩‍🏫' };
    dbData.teachers.push(newT);
    res.json({ success: true, item: newT });
});

// Удалить преподавателя
app.delete('/api/admin/teacher/:id', (req, res) => {
    const { secret } = req.body;
    if (secret !== process.env.ADMIN_SECRET) return res.status(403).json({ error: 'Доступ запрещен' });
    
    dbData.teachers = dbData.teachers.filter(t => t.id != req.params.id);
    res.json({ success: true });
});

// Удалить сертификат
app.delete('/api/admin/cert/:id', (req, res) => {
    const { secret } = req.body;
    if (secret !== process.env.ADMIN_SECRET) return res.status(403).json({ error: 'Доступ запрещен' });
    
    dbData.certificates = dbData.certificates.filter(c => c.id != req.params.id);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

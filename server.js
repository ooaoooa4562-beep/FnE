const express = require('express');
const path = require('path');
const multer = require('multer');
const app = express();

// Настройка хранилища для загружаемых фото через multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Сохраняем файлы в папочку public/uploads
        cb(null, path.join(__dirname, 'public/uploads'));
    },
    filename: (req, file, cb) => {
        // Генерируем уникальное имя файла, чтобы избежать конфликтов
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Middleware
app.use(express.json());

// Раздача статических файлов из папки public (теперь index.html и style.css лежат там)
app.use(express.static(path.join(__dirname, 'public')));

// Отдельный доступ к папке с загруженными картинками по адресу /uploads/имя_файла
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// 1. API для приема заявок и отправки в Telegram
app.post('/api/submit', async (req, res) => {
    try {
        const { name, phone, course, level, goals } = req.body;
        const botToken = process.env.BOT_TOKEN;
        const chatId = process.env.CHAT_ID;

        if (!botToken || !chatId) {
            return res.status(500).json({ success: false, error: 'Токены не настроены в переменных окружения' });
        }

        const message = `🚀 Новая заявка (Fast and Easy):\n\n👤 Имя: ${name}\n📞 Телефон: ${phone}\n📚 Курс: ${course}\n📊 Уровень: ${level}\n🎯 Цель: ${goals || 'Не указана'}`;

        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message })
        });

        const data = await response.json();
        if (!data.ok) throw new Error('Ошибка при отправке в Telegram');

        res.status(200).json({ success: true, message: 'Заявка успешно отправлена!' });
    } catch (error) {
        console.error('Ошибка сервера:', error);
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
});

// 2. API для загрузки фотографий на сервер
app.post('/api/upload', upload.single('photo'), (req, res) => {
    try {
        if (!req.file) {
            return.status(400).json({ success: false, error: 'Файл не был передан' });
        }
        // Возвращаем клиенту путь к загруженной картинке
        const fileUrl = `/uploads/${req.file.filename}`;
        res.status(200).json({ success: true, url: fileUrl });
    } catch (error) {
        console.error('Ошибка загрузки фото:', error);
        res.status(500).json({ success: false, error: 'Не удалось загрузить файл' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

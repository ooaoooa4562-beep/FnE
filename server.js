// server.js — главный файл сервера
const express = require('express');
const path = require('path');
const { sendLeadToTelegram } = require('./bot'); // Импортируем наш модуль бота

const app = express();
const PORT = process.env.PORT || 3000;

// Разрешаем серверу обрабатывать JSON
app.use(express.json());

// Раздаем статические файлы сайта из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Эндпоинт для приема заявок с сайта
app.post('/api/send-lead', async (req, res) => {
    try {
        await sendLeadToTelegram(req.body);
        res.json({ ok: true });
    } catch (err) {
        console.error('Ошибка при отправке в Telegram:', err.message);
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

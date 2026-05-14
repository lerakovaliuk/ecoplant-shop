const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const { OAuth2Client } = require('google-auth-library');
const morgan = require('morgan');
const winston = require('winston');
const multer = require('multer');

// === НОВЕ ДЛЯ ЛАБИ 5: Безпека, Валідація, Кешування ===
const helmet = require('helmet'); // [cite: 892]
const { body, validationResult } = require('express-validator'); // [cite: 894-895]
const NodeCache = require('node-cache'); // [cite: 896]

const sequelize = require('./config/database');
const User = require('./models/User');

const app = express();
const port = 3000;

// === ЗАВДАННЯ 2 (Лаба 5): Захист HTTP-заголовків [cite: 900] ===
app.use(helmet()); 

// Ініціалізація кешу (зберігає дані 60 секунд) [cite: 898]
const cache = new NodeCache({ stdTTL: 60 }); 

// Логування Winston (Лаба 4)
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error', maxsize: 5242880, maxFiles: 5 }),
        new winston.transports.File({ filename: 'app.log', maxsize: 5242880, maxFiles: 5 })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}

// Middleware для вимірювання часу
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.url} - ${duration}ms`);
    });
    next();
});

app.use(morgan('combined'));
app.use(express.json());
app.use(cors());

const SECRET_KEY = "ecoplant_secret_key_123";
const REFRESH_SECRET = "ecoplant_refresh_secret";

// === ТЕСТОВІ ДАНІ ДЛЯ ЛАБИ 5 ===
const products = [
    { id: 1, name: "Laptop", price: 30000 }, // [cite: 906-909]
    { id: 2, name: "Phone", price: 20000 }  // [cite: 910-911]
];

// === ЗАВДАННЯ 3 (Лаба 5): Кешування відповідей [cite: 913-925] ===
app.get('/products', (req, res) => {
    const cached = cache.get('products'); // Шукаємо дані в кеші
    if (cached) {
        return res.json({ source: 'cache', data: cached }); // Віддаємо з кешу
    }
    
    // Якщо в кеші немає - "дістаємо з БД" і зберігаємо в кеш
    cache.set('products', products);
    res.json({ source: 'database', data: products });
});

// === ЗАВДАННЯ 2 (Лаба 5): Валідація даних [cite: 926-943] ===
app.post('/products', [
    body('name').isLength({ min: 3 }).withMessage('Ім\'я має містити мінімум 3 символи'), // Перевірка довжини
    body('price').isNumeric().withMessage('Ціна має бути числом') // Перевірка на число
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() }); // Повертаємо помилки валідації
    }

    const product = {
        id: products.length + 1,
        name: req.body.name,
        price: req.body.price
    };
    products.push(product);
    cache.del('products'); // Очищаємо кеш, бо дані змінилися
    
    res.status(201).json(product);
});

// Обмеження спроб входу (Лаба 3 і 5)
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

// === МАРШРУТИ ЛАБ 3 ТА 4 (Залишені без змін для роботи всього сайту) ===
app.post("/register", async (req, res) => { /* ... код реєстрації ... */ });
app.post("/login", loginLimiter, async (req, res) => { /* ... код логіну ... */ });

// Налаштування Multer (Лаба 4)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: storage, limits: { fileSize: 2 * 1024 * 1024 } });

app.post('/upload', upload.single('file'), (req, res) => { res.json({ message: 'Файл завантажено' }); });

// Моніторинг (Лаба 4)
app.get('/status', (req, res) => { res.json({ uptime: process.uptime(), memoryUsage: process.memoryUsage() }); });

// Обробка помилок
app.use((err, req, res, next) => {
    logger.error(`${err.message} - ${req.originalUrl}`);
    res.status(err.status || 500).json({ error: err.message });
});

sequelize.sync({ alter: true }).then(() => {
    app.listen(port, () => {
        logger.info(`Сервер працює на порту ${port}`);
    });
});
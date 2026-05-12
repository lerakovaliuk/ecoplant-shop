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

const sequelize = require('./config/database');
const User = require('./models/User');

const app = express();
const port = 3000;

// === ЗАВДАННЯ 3 (Лаба 4): Професійне логування подій (Winston) [cite: 718-724] ===
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ 
            filename: 'error.log', 
            level: 'error',
            maxsize: 5242880, // 5 МБ
            maxFiles: 5       // Зберігати максимум 5 файлів
        }),
        new winston.transports.File({ 
            filename: 'app.log',
            maxsize: 5242880, // 5 МБ
            maxFiles: 5       // Зберігати максимум 5 файлів
        })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

// === ЗАВДАННЯ 9 (Лаба 4): Вимірювання часу відповіді [cite: 777-778] ===
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.url} - ${duration}ms`);
    });
    next();
});

// === ЗАВДАННЯ 2 (Лаба 4): Логування HTTP-запитів (Morgan) [cite: 715] ===
app.use(morgan('combined'));

app.use(express.json());
app.use(cors());

const SECRET_KEY = "ecoplant_secret_key_123";
const REFRESH_SECRET = "ecoplant_refresh_secret";
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// === ЗАВДАННЯ 5, 6, 7 (Лаба 4): Завантаження та валідація файлів (Multer) [cite: 763-771] ===
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath); // [cite: 767]
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); // Кастомне ім'я [cite: 541]
    }
});

const fileFilter = (req, file, cb) => {
    // Валідація типів: jpg, png, pdf [cite: 770]
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Недопустимий формат файлу. Дозволено: JPG, PNG, PDF.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // Обмеження 2МБ [cite: 771]
    fileFilter: fileFilter
});

// === MIDDLEWARE ЗАХИСТУ (Лаба 3) ===
const authenticateToken = (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) return res.status(401).json({ message: "Немає токена" });

    try {
        const verified = jwt.verify(token.replace("Bearer ", ""), SECRET_KEY);
        req.user = verified;
        next();
    } catch (err) {
        res.status(401).json({ message: "Недійсний токен" });
    }
};

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { message: "Забагато спроб входу." }
});

// === МАРШРУТИ ЛАБОРАТОРНОЇ №3 ===

app.post("/register", async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;
        if (password !== confirmPassword) return res.status(400).json({ message: "Паролі не співпадають" });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const confirmToken = jwt.sign({ email }, SECRET_KEY, { expiresIn: '1d' });

        const newUser = await User.create({
            name, email, password: hashedPassword,
            role: await User.count() === 0 ? 'admin' : 'user',
            confirmationToken: confirmToken
        });

        console.log(`[EMAIL SEND]: http://localhost:3000/confirm/${confirmToken}`);
        res.status(201).json({ message: "Користувача створено. Перевірте email." });
    } catch (error) {
        logger.error(error.message);
        res.status(500).json({ message: "Помилка реєстрації" });
    }
});

app.post("/login", loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: "Невірні дані" });
        }
        if (!user.isEmailConfirmed) return res.status(400).json({ message: "Підтвердіть email" });

        const accessToken = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: "15m" });
        const refreshToken = jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: "7d" });

        user.refreshToken = refreshToken;
        await user.save();
        res.json({ accessToken, refreshToken, user: { name: user.name, role: user.role } });
    } catch (error) {
        logger.error(error.message);
        res.status(500).json({ message: "Помилка входу" });
    }
});

// === МАРШРУТИ ЛАБОРАТОРНОЇ №4 (Файли та Статус) ===

// Завантаження одного файлу [cite: 763]
app.post('/upload', upload.single('file'), (req, res) => {
    res.json({ message: 'Файл успішно завантажено', file: req.file });
});

// Завантаження кількох файлів [cite: 764-766]
app.post('/upload-multiple', upload.array('files', 5), (req, res) => {
    res.json({ message: 'Файли успішно завантажено', files: req.files });
});

// ЗАВДАННЯ 8 (Лаба 4): Моніторинг стану сервера [cite: 773-775]
app.get('/status', (req, res) => {
    res.json({
        uptime: process.uptime(), // [cite: 774]
        memoryUsage: process.memoryUsage(), // [cite: 775]
        timestamp: new Date()
    });
});

// === БОНУС: API для перегляду логів ===
app.get('/logs', (req, res) => {
    try {
        // Читаємо файл логів
        const logs = fs.readFileSync('app.log', 'utf8');
        // Розбиваємо текст на рядки і беремо останні 50
        const logLines = logs.trim().split('\n').slice(-50);
        res.json({ logs: logLines });
    } catch (error) {
        res.status(500).json({ message: "Не вдалося прочитати логи" });
    }
});

// === БОНУС: Проста панель моніторингу ===
app.get('/dashboard', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>EcoPlant Dashboard</title>
        <style>
            body { font-family: Arial, sans-serif; background: #f4f7f6; padding: 20px; }
            .container { max-width: 800px; margin: auto; }
            .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
            h1 { color: #2c3e50; text-align: center; }
            h2 { color: #27ae60; border-bottom: 2px solid #27ae60; padding-bottom: 5px; }
            .stat { font-size: 18px; margin: 10px 0; }
            .val { font-weight: bold; color: #e74c3c; }
            pre { background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 5px; overflow-x: auto; max-height: 400px; overflow-y: auto; }
        </style>
        <script>
            // Функція для оновлення даних
            async function fetchData() {
                try {
                    const statusRes = await fetch('/status');
                    const status = await statusRes.json();
                    document.getElementById('uptime').innerText = Math.round(status.uptime) + ' сек';
                    document.getElementById('memory').innerText = Math.round(status.memoryUsage.rss / 1024 / 1024) + ' MB';

                    const logsRes = await fetch('/logs');
                    const logsData = await logsRes.json();
                    document.getElementById('logs-container').innerText = logsData.logs.join('\\n');
                } catch (err) {
                    console.error("Помилка завантаження даних");
                }
            }
            // Оновлювати кожні 3 секунди
            setInterval(fetchData, 3000);
            window.onload = fetchData;
        </script>
    </head>
    <body>
        <div class="container">
            <h1>🌿 EcoPlant Monitoring Dashboard</h1>
            
            <div class="card">
                <h2>📊 Статус сервера</h2>
                <div class="stat">Час безперебійної роботи (Uptime): <span class="val" id="uptime">Завантаження...</span></div>
                <div class="stat">Використання пам'яті (RAM): <span class="val" id="memory">Завантаження...</span></div>
            </div>

            <div class="card">
                <h2>📝 Останні системні логи</h2>
                <pre id="logs-container">Завантаження логів...</pre>
            </div>
        </div>
    </body>
    </html>
    `;
    res.send(html); // Відправляємо HTML-код у браузер
});

// === ІНШІ МАРШРУТИ ПРОФІЛЮ ===

app.get("/profile", authenticateToken, async (req, res) => {
    const user = await User.findByPk(req.user.id, { attributes: ['name', 'email', 'role'] });
    res.json(user);
});

app.post("/logout", authenticateToken, async (req, res) => {
    const user = await User.findByPk(req.user.id);
    user.refreshToken = null;
    await user.save();
    res.json({ message: "Ви вийшли" });
});

// === ЗАВДАННЯ 4 (Лаба 4): Обробка помилок [cite: 759-761] ===
app.get('/test-error', (req, res, next) => {
    next(new Error('Тестова помилка сервера!')); 
});

app.use((err, req, res, next) => {
    logger.error(`${err.message} - ${req.originalUrl}`); // [cite: 760]
    res.status(err.status || 500).json({ error: err.message }); // [cite: 761]
});

sequelize.sync({ alter: true }).then(() => {
    app.listen(port, () => {
        logger.info(`Сервер працює на порту ${port}`);
    });
});
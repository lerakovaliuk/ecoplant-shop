const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const sequelize = require('./config/database');
const User = require('./models/User');
const { OAuth2Client } = require('google-auth-library');

const app = express();
app.use(express.json());
app.use(cors()); // Дозволяє запити з вашого сайту EcoPlant

const SECRET_KEY = "ecoplant_secret_key_123";
const REFRESH_SECRET = "ecoplant_refresh_secret";
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// === ЗАВДАННЯ 13: Логування помилок === 
const logError = (error) => {
    const logMessage = `${new Date().toISOString()} - ${error.message}\n`;
    fs.appendFileSync("error.log", logMessage);
    console.error(error);
};

// === ЗАВДАННЯ 15: Middleware для перевірки токена === 
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

// === ЗАВДАННЯ 14: Обмеження спроб входу === 
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 хвилин
    max: 5, // Максимум 5 спроб
    message: { message: "Забагато спроб входу. Спробуйте через 15 хвилин." }
});

// === ЗАВДАННЯ 2, 3, 7, 11, 19: Реєстрація === 
app.post("/register", async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;

        if (!name || !email || !password || !confirmPassword) return res.status(400).json({ message: "Всі поля обов'язкові" });
        if (password !== confirmPassword) return res.status(400).json({ message: "Паролі не співпадають" }); // Завдання 7
        
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) return res.status(400).json({ message: "Email вже існує" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const confirmToken = jwt.sign({ email }, SECRET_KEY, { expiresIn: '1d' });

        const newUser = await User.create({
            name, email, password: hashedPassword,
            role: await User.count() === 0 ? 'admin' : 'user', // Завдання 8
            confirmationToken: confirmToken
        });

        // ІМІТАЦІЯ ЗАВДАННЯ 19: Відправка email
        console.log(`[EMAIL SEND]: Для підтвердження пошти перейдіть: http://localhost:3000/confirm/${confirmToken}`);

        res.status(201).json({ message: "Користувача створено. Перевірте email." });
    } catch (error) {
        logError(error); res.status(500).json({ message: "Помилка реєстрації" });
    }
});

// === ЗАВДАННЯ 19: Підтвердження email === 
app.get("/confirm/:token", async (req, res) => {
    try {
        const user = await User.findOne({ where: { confirmationToken: req.params.token } });
        if (!user) return res.status(400).send("Недійсний токен");
        
        user.isEmailConfirmed = true;
        user.confirmationToken = null;
        await user.save();
        res.send("Email успішно підтверджено!");
    } catch (error) {
        logError(error); res.status(500).send("Помилка");
    }
});

// === ЗАВДАННЯ 2, 12: Авторизація (з Refresh токеном) === 
app.post("/login", loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ where: { email } });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: "Невірний логін або пароль" });
        }
        if (!user.isEmailConfirmed) return res.status(400).json({ message: "Підтвердіть email" });

        const accessToken = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: "15m" });
        const refreshToken = jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: "7d" }); // Завдання 12

        user.refreshToken = refreshToken;
        await user.save();

        res.json({ accessToken, refreshToken, user: { name: user.name, role: user.role } });
    } catch (error) {
        logError(error); res.status(500).json({ message: "Помилка входу" });
    }
});

// === ЗАВДАННЯ 20: Реалізувати OAuth (Google login) ===
app.post("/auth/google", async (req, res) => {
    try {
        // Отримуємо токен, який прислав клієнт
        const { token } = req.body; 

        // 1. Звертаємося до Google, щоб перевірити, чи токен не підроблений
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        
        // 2. Витягуємо дані користувача з перевіреного токена
        const payload = ticket.getPayload(); 
        const { email, name } = payload;

        // 3. Шукаємо користувача в нашій базі
        let user = await User.findOne({ where: { email } });

        // 4. Якщо користувача немає - автоматично реєструємо його
        if (!user) {
            user = await User.create({
                name: name,
                email: email,
                password: null, // Пароль не потрібен, бо авторизація через Google
                role: 'user',
                isEmailConfirmed: true // Google вже перевірив цю пошту
            });
        }

        // 5. Видаємо наші внутрішні токени (як при звичайному логіні)
        const accessToken = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: "15m" });
        const refreshToken = jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: "7d" });

        user.refreshToken = refreshToken;
        await user.save();

        res.json({ accessToken, refreshToken, user: { name: user.name, role: user.role } });
    } catch (error) {
        logError(error);
        res.status(401).json({ message: "Помилка авторизації через Google" });
    }
});

// === ЗАВДАННЯ 4: Захищений маршрут === 
app.get("/profile", authenticateToken, async (req, res) => {
    const user = await User.findByPk(req.user.id, { attributes: ['name', 'email', 'role'] });
    res.json(user);
});

// === ЗАВДАННЯ 10: Оновлення профілю === 
app.put("/profile", authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (req.body.name) user.name = req.body.name;
        await user.save();
        res.json({ message: "Профіль оновлено", user });
    } catch (error) {
        logError(error); res.status(500).json({ message: "Помилка оновлення" });
    }
});

// === ЗАВДАННЯ 16: Зміна пароля === 
app.post("/change-password", authenticateToken, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await User.findByPk(req.user.id);
        
        if (!(await bcrypt.compare(oldPassword, user.password))) return res.status(400).json({ message: "Старий пароль невірний" });
        
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ message: "Пароль змінено" });
    } catch (error) {
        logError(error); res.status(500).json({ message: "Помилка" });
    }
});

// === ЗАВДАННЯ 17: Видалення користувача === 
app.delete("/profile", authenticateToken, async (req, res) => {
    await User.destroy({ where: { id: req.user.id } });
    res.json({ message: "Користувача видалено" });
});

// === ЗАВДАННЯ 18: Відновлення пароля === 
app.post("/forgot-password", async (req, res) => {
    const user = await User.findOne({ where: { email: req.body.email } });
    if (user) {
        const resetToken = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '1h' });
        user.resetPasswordToken = resetToken;
        await user.save();
        console.log(`[EMAIL SEND]: Відновлення пароля: http://localhost:3000/reset/${resetToken}`);
    }
    // Завжди повертаємо успіх (захист від перебору email-ів)
    res.json({ message: "Якщо email існує, ми надіслали інструкції." });
});

// === ЗАВДАННЯ 9: Logout === 
// У JWT сервер не знищує токен, ми просто видаляємо refresh token з бази
app.post("/logout", authenticateToken, async (req, res) => {
    const user = await User.findByPk(req.user.id);
    user.refreshToken = null;
    await user.save();
    res.json({ message: "Ви успішно вийшли" });
});

// Синхронізація та запуск
sequelize.sync({ alter: true }).then(() => {
    app.listen(3000, () => console.log("Сервер з усіма 20 завданнями запущено!"));
});
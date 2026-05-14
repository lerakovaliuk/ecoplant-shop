const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const NodeCache = require('node-cache');
const morgan = require('morgan');
const winston = require('winston');
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const sequelize = require('./config/database');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet()); 
app.use(morgan('combined'));
app.use(express.json());
app.use(cors());

const cache = new NodeCache({ stdTTL: 60 }); 
const SECRET_KEY = "ecoplant_secret_key_123";

// === НАЛАШТУВАННЯ SWAGGER ===
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'EcoPlant API',
            version: '1.0.0',
            description: 'Документація REST API для магазину EcoPlant',
        },
        servers: [
            { url: `http://localhost:${PORT}`, description: 'Локальний сервер' }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                }
            }
        },
    },
    apis: [path.join(__dirname, 'server.js')], 
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const products = [
    { id: 1, name: "Laptop", price: 30000 },
    { id: 2, name: "Phone", price: 20000 }
];

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Отримати список товарів
 *     description: Повертає масив товарів (з використанням кешування)
 *     responses:
 *       200:
 *         description: Успішна відповідь
 */
app.get('/products', (req, res) => {
    const cached = cache.get('products');
    if (cached) return res.json({ source: 'cache', data: cached });
    
    cache.set('products', products);
    res.json({ source: 'database', data: products });
});

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Створити новий товар
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Tablet"
 *               price:
 *                 type: number
 *                 example: 15000
 *     responses:
 *       201:
 *         description: Товар успішно створено
 *       400:
 *         description: Помилка валідації
 */
app.post('/products', [
    body('name').isLength({ min: 3 }),
    body('price').isNumeric()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const product = { id: products.length + 1, name: req.body.name, price: req.body.price };
    products.push(product);
    cache.del('products'); 
    res.status(201).json(product);
});

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Реєстрація користувача
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       201:
 *         description: Користувача створено
 */
app.post("/register", async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;
        if (password !== confirmPassword) return res.status(400).json({ message: "Паролі не співпадають" });
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) return res.status(400).json({ message: "Email вже існує" });
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ name, email, password: hashedPassword, isEmailConfirmed: true });
        res.status(201).json({ message: "Користувача створено", user: newUser });
    } catch (error) {
        res.status(500).json({ message: "Помилка сервера" });
    }
});

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Авторизація користувача
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Повертає JWT токен
 */
app.post("/login", loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: "Невірні дані" });
        }
        const accessToken = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: "15m" });
        res.json({ accessToken });
    } catch (error) {
        res.status(500).json({ message: "Помилка сервера" });
    }
});

app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message });
});

sequelize.sync({ alter: true }).then(() => {
    app.listen(PORT, () => {
        console.log(`Сервер запущено на порті ${PORT}. Документація: http://localhost:${PORT}/api-docs`);
    });
});
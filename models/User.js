const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: true }, // allowNull: true для Google користувачів
    role: { type: DataTypes.STRING, defaultValue: 'user' }, // Завдання 8: Ролі
    isEmailConfirmed: { type: DataTypes.BOOLEAN, defaultValue: false }, // Завдання 19: Підтвердження email
    confirmationToken: { type: DataTypes.STRING, allowNull: true },
    resetPasswordToken: { type: DataTypes.STRING, allowNull: true }, // Завдання 18: Відновлення пароля
    refreshToken: { type: DataTypes.STRING, allowNull: true } // Завдання 12: Refresh token
});

module.exports = User;
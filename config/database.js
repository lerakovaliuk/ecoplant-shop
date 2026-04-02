const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('web_backend_lab', 'root', '', {
    host: 'localhost',
    dialect: 'mysql'
});

module.exports = sequelize;
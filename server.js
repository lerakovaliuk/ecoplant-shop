const sequelize = require('./config/database');
const User = require('./models/User');
const Post = require('./models/Post');

User.hasMany(Post);
Post.belongsTo(User);

async function startApp() {
    try {
        await sequelize.authenticate();
        console.log("Sequelize успішно підключився до БД!");

        await sequelize.sync({ force: true }); 
        console.log("Таблиці очищено і створено заново!");

        // === 1. Користувач Іван ===
        const user1 = await User.create({ name: 'Іван', email: 'ivan@gmail.com' });
        await Post.create({ 
            title: 'Мій перший відгук', 
            content: 'Дуже гарні рослини у вашому магазині!', 
            UserId: user1.id 
        });

        // === 2. Користувач Олена ===
        const user2 = await User.create({ name: 'Олена', email: 'olena@ukr.net' });
        await Post.create({ 
            title: 'Питання про фікус', 
            content: 'Підкажіть, як часто його поливати взимку?', 
            UserId: user2.id 
        });

        // === 3. Користувач Марія ===
        const user3 = await User.create({ name: 'Марія', email: 'maria@ecoplant.com' });
        await Post.create({ 
            title: 'Супер сервіс', 
            content: 'Замовляла монстеру, приїхала ціла і дуже швидко.', 
            UserId: user3.id 
        });

        console.log("Всіх користувачів успішно записано в базу!");

    } catch (error) {
        console.error("Помилка:", error);
    }
}

startApp();
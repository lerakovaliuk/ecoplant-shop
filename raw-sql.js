const mysql = require('mysql2/promise'); // Використовуємо асинхронний драйвер

async function testDatabase() {
    // 1. Підключення до бази даних 
    const connection = await mysql.createConnection({
        host: 'localhost', 
        user: 'root',
        password: '', 
        database: 'web_backend_lab'
    });

    console.log("Успішно підключено до бази даних через mysql2!");

    // 2. Створення таблиці users
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL
        )
    `);
    console.log("Таблиця users готова.");

    // 3. Додавання даних (INSERT)
    await connection.execute(
        'INSERT INTO users (name, email) VALUES (?, ?)', 
        ['Олена', 'olena@gmail.com']
    );
    console.log("Дані додано (INSERT).");

    // 4. Оновлення даних (UPDATE)
    await connection.execute(
        'UPDATE users SET name = ? WHERE email = ?', 
        ['Олена Ковалюк', 'olena@gmail.com']
    );
    console.log("Дані оновлено (UPDATE).");

    // 5. Отримання даних (SELECT)
    const [rows] = await connection.execute('SELECT * FROM users');
    console.log("Отримані дані (SELECT):", rows);

    // 6. Видалення даних (DELETE)
    // await connection.execute('DELETE FROM users WHERE email = ?', ['olena@gmail.com']);
    // console.log("Дані видалено (DELETE).");

    // Закриваємо з'єднання
    await connection.end();
}

testDatabase();
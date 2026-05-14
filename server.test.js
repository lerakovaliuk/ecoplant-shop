const request = require('supertest');

describe('Тестування API EcoPlant (Лаба 5)', () => {
    
    // Тест 1: Перевірка отримання товарів (GET)
    test('GET /products - має повернути статус 200', async () => {
        const response = await request('http://localhost:3000').get('/products');
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('source'); // Перевіряємо, чи є поле source (cache або database)
    });

    // Тест 2: Перевірка валідації (POST з помилкою)
    test('POST /products - помилка валідації при неправильних даних', async () => {
        const response = await request('http://localhost:3000')
            .post('/products')
            .send({ name: "A", price: "безцінно" }); // Спеціально шлемо неправильні дані
        
        expect(response.statusCode).toBe(400); // Очікуємо статус 400 Bad Request
        expect(response.body).toHaveProperty('errors');
    });

});
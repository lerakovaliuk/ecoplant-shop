// --- 1. Логіка Бургер-меню ---
const burgerBtn = document.querySelector('.burger-menu');
const navMenu = document.querySelector('.nav-menu');

burgerBtn.addEventListener('click', () => {
    // Додаємо або забираємо клас 'active' при кліку
    navMenu.classList.toggle('active');
});

// --- 2. Логіка Модального вікна кошика ---
const cartBtn = document.querySelector('.cart-btn');
const cartModal = document.getElementById('cart-modal');
const closeCartBtn = document.querySelector('.close-cart');

// Відкрити кошик
cartBtn.addEventListener('click', () => {
    cartModal.style.display = 'flex';
});

// Закрити кошик на хрестик
closeCartBtn.addEventListener('click', () => {
    cartModal.style.display = 'none';
});

// Закрити кошик при кліку на темний фон поза вікном
window.addEventListener('click', (event) => {
    if (event.target === cartModal) {
        cartModal.style.display = 'none';
    }
});
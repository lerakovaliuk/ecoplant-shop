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

// Приклад логіну на фронтенді
async function loginUser(email, password) {
    const response = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    if (response.ok) {
        // Зберігаємо токени у пам'ять браузера (localStorage)
        localStorage.setItem("accessToken", data.accessToken);
        alert("Вхід успішний!");
    } else {
        alert("Помилка: " + data.message);
    }
}

async function getProfile() {
    const token = localStorage.getItem("accessToken");
    
    const response = await fetch("http://localhost:3000/profile", {
        method: "GET",
        headers: { 
            "Authorization": `Bearer ${token}` 
        }
    });
    
    if (response.ok) {
        const user = await response.json();
        console.log("Мої дані:", user);
    } else {
        alert("Ви не авторизовані!");
    }
}

function logout() {
    // Відправляємо запит на сервер, щоб стерти Refresh Token (Завдання 9)
    const token = localStorage.getItem("accessToken");
    fetch("http://localhost:3000/logout", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
    });

    // Видаляємо токени з браузера
    localStorage.removeItem("accessToken");
    alert("Ви вийшли з системи!");
    window.location.href = "index.html"; // Перекидаємо на головну
}
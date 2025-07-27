require('dotenv').config();
const express = require('express');
const {Pool} = require('pg');

const app = express();
const port = process.env.PORT||3000;

app.use(express.json());

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT||'5432', 10),
});

const checkUser = async (id) => {
    const result = await pool.query('SELECT id FROM person WHERE id = $1', [id])
    if (result.rowCount === 0) {
        return false
    }
    return true
}

const checkId = (id) => {
    if (id === undefined || isNaN(parseInt(id, 10)) || id <= 0) {
        return false
    }
    return true
}

const checkMenu = async (id) => {
    const result = await pool.query('SELECT id FROM menu WHERE id = $1', [id])
    if (result.rowCount === 0) {
        return false
    }
    return true
}

const checkPizzeria = (id) => {
    if (id === undefined || isNaN(parseInt(id, 10)) || id <= 0) {
        return false
    }
    return true
}

const checkPizza = (id) => {
    if (id === undefined || isNaN(parseInt(id, 10)) || id <= 0) {
        return false
    }
    return true
}

pool.connect((err, client, release) => {
    if (err) {
        return console.error('Ошибка подключения к БД:', err);
    }
    client.query('SELECT NOW()', (err, result) => {
        release();
        if (err) {
            return console.error('Ощибка выполнения текстового запроса:', err.stack);
        }
        console.log('Успешно подключено к PostgreSQL. Текущее время с БД:', result.rows[0].now)
    })
})

app.get('/api/persons', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, age, gender, address FROM person ORDER BY name');
        console.log("Все ок")
        res.json(result.rows);
    }catch (err){
        console.error('Ошибка при получении списка людей:', err.stack);
        res.status(500).json({error:'Внутренняя ошибка сервера'});
    }
});

app.get('/api/menu/:id', async (req, res) => {
    try {
        const {id} = req.params
        const result = await pool.query('SELECT menu.pizza_name, menu.price FROM pizzeria JOIN menu ON pizzeria_id = pizzeria.id WHERE pizzeria.id = $1 ORDER BY pizzeria.name',[id])
        res.json(result.rows);
        console.log(result.rows)
    }catch (err){
        console.error('Ошибка при получении меню пиццерии:', err.stack)
        res.status(500).json({error: 'Внутренняя ошибка сервера'});
    }
});

app.get('/api/pizzeria', async (req, res) => {
    try {
        const result = await pool.query('SELECT pizzeria.id, pizzeria.name FROM pizzeria')
        res.json(result.rows);
        console.log(result.rows)
    } catch (error) {
        console.error('Ошибка при получении списка пиццерий:', err.stack)
        res.status(500).json({error: 'Внутренняя ошибка сервера'});
    }
});

app.post('/api/pizzeria', async (req, res) => {
    try {
        const {name, rating} = req.body

        if (!name || typeof name !== 'string' || name.trim() === ''){
            return res.status(400).json({error: "Поле 'name' обязательно и должно быть непустой строкой"});
        }
        if (rating !== undefined && (typeof rating !== 'number' || rating < 0 || rating > 5)){
            return res.status(400).json({error: "Поле 'rating' должно быть числом от 0 до 5"});
        }

        const queryText = 'INSERT INTO pizzeria(name, rating) VALUES($1, $2) RETURNING *';
        const queryValues = [name, rating !== undefined ? rating : 0]
        const result = await pool.query(queryText, queryValues);

        res.status(201).json(result.rows[0])
    } catch (error) {
        console.error('Ошибка при добавлении пиццерии:', error.stack)
        res.status(500).json({error: 'Внутренняя ошибка сервера'});
    }
});

app.post('/api/menu/:pizzeria_id', async (req, res) => {
    try {
        const {pizzeria_id} = req.params
        const {pizza_name, price} = req.body

        if (!pizza_name || typeof pizza_name !== 'string' || pizza_name.trim() === ''){
            return res.status(400).json({error: "Поле 'pizza_name' обязательно и должно быть непустой строкой"});
        }
        if (price === undefined || typeof price !== 'number' || price <= 0) {
            return res.status(400).json({ error: "Поле 'price' обязательно и должно быть положительным числом" });
        }
        if (pizzeria_id === undefined || isNaN(parseInt(pizzeria_id, 10)) || pizzeria_id <= 0) {
            return res.status(400).json({ error: "Поле 'pizzeria_id' обязательно и должно быть положительным числом" });
        }

        const pizzeriaCheck = await pool.query('SELECT id FROM pizzeria WHERE id = $1', [pizzeria_id])
        if (!checkPizzeria(pizzeria_id)) {
            return res.status(404).json({error: `Пиццерия с ID ${pizzeria_id} не найдена`})
        }

        const queryText = 'INSERT INTO menu(pizzeria_id, pizza_name, price) VALUES($1, $2, $3) RETURNING *';
        const queryValues = [pizzeria_id, pizza_name.toLowerCase(), price];
        const newMenuItem = await pool.query(queryText, queryValues)

        res.status(201).json(newMenuItem.rows[0]);

    } catch (error) {
        console.error('Ошибка при добавлении пиццы в меню пиццерии:', error.stack)
        res.status(500).json({error: 'Внутренняя ошибка сервера'});
    }

});

app.post('/api/menu/change/price/:id', async (req, res) => {
        const {id} = req.params
        const {new_price} = req.body

        if (new_price === undefined || typeof new_price !== 'number' || new_price <= 0) {
            return res.status(400).json({ error: "Поле 'new_price' обязательно и должно быть положительным числом" });
        }
    try {
        const queryText = 'UPDATE menu SET price = $1 WHERE id = $2 RETURNING *'
        const result = await pool.query(queryText, [new_price, id])

        if (!checkPizza(id)) {
            return res.status(404).json({error: `Пицца с ID ${id} не найдена`})
        }

        res.status(200).json({
            message: `Цена пиццы ID ${id} успешно изменена`,
            pizzeria: result.rows[0]
        })
    } catch (error) {
        console.error('Ошибка при изменении цены пиццы:', error.stack)
        res.status(500).json({error: 'Внутренняя ошибка сервера'});
    }
});

app.post('/api/pizzeria/change/rating/:id', async (req, res) => {
        const {id} = req.params
        const {new_rating} = req.body

        if (new_rating !== undefined && (typeof new_rating !== 'number' || new_rating < 0 || new_rating > 5)){
            return res.status(400).json({error: "Поле 'new_rating' должно быть числом от 0 до 5"});
        }
    try {
        const queryText = 'UPDATE pizzeria SET rating = $1 WHERE id = $2 RETURNING *'
        const result = await pool.query(queryText, [new_rating, id])

        if (!checkPizzeria(id)) {
            return res.status(404).json({error: `Пиццерия с ID ${id} не найдена`})
        }

        res.status(200).json({
            message: `Рейтинг пиццерии с ID ${id} успешно изменён`,
            pizzeria: result.rows[0]
        })
    } catch (error) {
        console.error('Ошибка при изменении рейтинга пиццерии:', error.stack)
        res.status(500).json({error: 'Внутренняя ошибка сервера'});
    }
});


app.delete('/api/pizzeria/:id', async (req, res) => {
    const {id} = req.params

    if (isNaN(parseInt(id, 10))) {
        return res.status(400).json({error: 'ID пиццерии должен быть числом'});
    }

    try {

        const queryText = 'UPDATE pizzeria SET is_deleted = TRUE WHERE id = $1 RETURNING *'
        const result = await pool.query(queryText, [id]);

        if (!checkPizzeria(id)) {
            return res.status(404).json({error: `Пиццерия с ID ${id} не найдена.`})
        }

        res.status(200).json({
            message: `Пиццерия с ID ${id} успешно удалена.`,
            pizzeria: result.rows[0]
        })

    } catch (error) {
        console.error(`Ошибка при мягком удалении пиццерии с ID ${id}:`, err.stack)
        res.status(500).json({error: 'Внутренняя ошибка сервера.'})
    }

})

app.delete('/api/menu/:id', async (req, res) => {
    const {id} = req.params

    if (isNaN(parseInt(id, 10))) {
        return res.status(400).json({error: 'ID позицции должен быть числом'});
    }

    try {

        const queryText = 'UPDATE menu SET is_deleted = TRUE WHERE id = $1 RETURNING *'
        const result = await pool.query(queryText, [id]);

        if (!checkPizza(id)) {
            return res.status(404).json({error: `Позиция с ID ${id} не найдена.`})
        }

        res.status(200).json({
            message: `Позиция с ID ${id} успешно удалена.`,
            pizzeria: result.rows[0]
        })

    } catch (error) {
        console.error(`Ошибка при мягком удалении позиции с ID ${id}:`, err.stack)
        res.status(500).json({error: 'Внутренняя ошибка сервера.'})
    }

})

app.get('/api/person/:id/orders', async (req, res) => {
    try {
        const {id} = req.params
        if (!checkId(id)) {
            return res.status(400).json({ error: "Поле 'id' обязательно и должно быть положительным числом" });
        }

        if (!checkUser(id)) {
            return res.status(404).json({error: `Посетитель с ID ${id} не найден.`})
        }
        const result = await pool.query('SELECT p.id, p.name, po.order_date::date AS date, m.pizza_name, m.price, pi.name AS pizzeria_name FROM person_order po INNER JOIN person p ON p.id = po.person_id INNER JOIN menu m ON m.id = po.menu_id INNER JOIN pizzeria pi ON pi.id = m.pizzeria_id WHERE p.id = $1', [id])
        res.status(200).json(result.rows)
    } catch (error) {
        console.error('Ошибка при получении списка покупок посетителя:', err.stack)
        res.status(500).json({error: 'Внутренняя ошибка сервера'});
    }
})

app.post('/api/person/:id/order', async (req, res) => {

    const {id} = req.params
    const {menu_id} = req.body

    if (!checkId(id) || !checkId(menu_id)) {
        return res.status(400).json({ error: "Поле 'id' обязательно и должно быть положительным числом" });
    }
    if (!checkUser(id)) {
        return res.status(404).json({error: `Посетитель с ID ${id} не найден.`})
    }
    if (!checkMenu(menu_id)) {
        return res.status(404).json({error: `Позиция с ID ${id} не найдена.`})
    }

    try {
        const result = await pool.query('insert into person_order(person_id, menu_id) values ($1, $2)', [id, menu_id])
        res.status(201).json(`Пользователь ${id} успешно заказал ${menu_id}`)
    } catch (error) {
        console.error('Ошибка при добавлении заказа:', err.stack)
        res.status(500).json({error: 'Внутренняя ошибка сервера'});
    }
})

app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`)
})

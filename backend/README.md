# Coach Management System - Backend

Веб-приложение для управления спортсменами, тренировками и данными тренера.

## Технологии

- **FastAPI** - современный веб-фреймворк для Python
- **SQLAlchemy** - ORM для работы с базой данных
- **SQLite** - база данных (можно заменить на PostgreSQL)
- **Pydantic** - валидация данных

## Установка

1. Установите зависимости:

```bash
pip install -r requirements.txt
```

2. Запустите приложение:

```bash
uvicorn app.main:app --reload
```

Приложение будет доступно по адресу: `http://localhost:8000`

### Заполнение тестовыми данными

Мок-данные из фронтенда можно загрузить в базу одной командой:

```bash
python -m app.seed_data
```

Скрипт создаст спортсменов, планы тренировок, тренировки, посещаемость, травмы, планы питания и примерные отчеты. При повторном запуске уже существующие данные пропускаются, поэтому скрипт можно выполнять безопасно.

## API Документация

После запуска приложения доступна интерактивная документация:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Структура проекта

```
backend/
├── app/
│   ├── models/          # SQLAlchemy модели
│   ├── schemas/         # Pydantic схемы
│   ├── api/             # API эндпоинты
│   ├── database.py      # Настройка БД
│   └── main.py          # Точка входа
└── requirements.txt
```

## API Эндпоинты

### Спортсмены (Athletes)

- `GET /athletes/` - Список спортсменов
- `GET /athletes/{id}` - Получить спортсмена
- `POST /athletes/` - Создать спортсмена
- `PUT /athletes/{id}` - Обновить спортсмена
- `DELETE /athletes/{id}` - Удалить спортсмена

### Планы тренировок (Training Plans)

- `GET /training-plans/` - Список планов
- `GET /training-plans/{id}` - Получить план
- `POST /training-plans/` - Создать план
- `PUT /training-plans/{id}` - Обновить план
- `DELETE /training-plans/{id}` - Удалить план

### Тренировки (Workouts)

- `GET /workouts/` - Список тренировок
- `GET /workouts/{id}` - Получить тренировку
- `POST /workouts/` - Создать тренировку
- `PUT /workouts/{id}` - Обновить тренировку
- `DELETE /workouts/{id}` - Удалить тренировку

### Посещаемость (Attendance)

- `GET /attendance/` - Список отметок
- `GET /attendance/{id}` - Получить отметку
- `POST /attendance/` - Создать отметку
- `PUT /attendance/{id}` - Обновить отметку
- `DELETE /attendance/{id}` - Удалить отметку

### Травмы (Injuries)

- `GET /injuries/` - Список травм
- `GET /injuries/{id}` - Получить травму
- `POST /injuries/` - Создать запись о травме
- `PUT /injuries/{id}` - Обновить травму
- `DELETE /injuries/{id}` - Удалить травму

### Планы питания (Nutrition Plans)

- `GET /nutrition-plans/` - Список планов
- `GET /nutrition-plans/{id}` - Получить план
- `POST /nutrition-plans/` - Создать план
- `PUT /nutrition-plans/{id}` - Обновить план
- `DELETE /nutrition-plans/{id}` - Удалить план

### Отчеты (Reports)

- `GET /reports/` - Список отчетов
- `GET /reports/{id}` - Получить отчет
- `GET /reports/generate/{type}` - Сгенерировать отчет
  - Типы: `attendance`, `injuries`, `progress`

## База данных

По умолчанию используется SQLite (`coach_app.db`). Для использования PostgreSQL:

1. Установите драйвер: `pip install psycopg2-binary`
2. Установите переменную окружения:
   ```bash
   export DATABASE_URL="postgresql://user:password@localhost/dbname"
   ```

## Примеры использования

### Создание спортсмена

```bash
curl -X POST "http://localhost:8000/athletes/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Иван Иванов",
    "email": "ivan@example.com",
    "phone": "+79001234567",
    "birth_date": "2000-01-15"
  }'
```

### Создание тренировки

```bash
curl -X POST "http://localhost:8000/workouts/" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-01-15T10:00:00",
    "time": "10:00",
    "location": "Спортзал",
    "description": "Силовая тренировка"
  }'
```

### Генерация отчета по посещаемости

```bash
curl "http://localhost:8000/reports/generate/attendance?athlete_id=1&start_date=2024-01-01&end_date=2024-01-31"
```

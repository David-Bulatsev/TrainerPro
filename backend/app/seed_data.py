import json
from datetime import date, datetime
from typing import Dict, List

from app.database import Base, SessionLocal, engine
from app.models import (
    Athlete,
    TrainingPlan,
    TrainingPlanAssignment,
    Workout,
    Attendance,
    Injury,
    NutritionPlan,
    Report,
    ReportType,
    User,
)
from app.core.security import get_password_hash
from app.core.rbac import ensure_default_rbac


MONTHS_MAP = {
    "янв": 1,
    "фев": 2,
    "мар": 3,
    "апр": 4,
    "май": 5,
    "мая": 5,
    "июн": 6,
    "июл": 7,
    "авг": 8,
    "сен": 9,
    "окт": 10,
    "ноя": 11,
    "дек": 12,
}


USERS_DATA = [
    {
        "email": "coach@demo.local",
        "full_name": "Demo Coach",
        "password": "password",
    }
]


def parse_russian_date(value: str) -> date:
    """Преобразовать строки вида '15 дек 2024' в date."""
    parts = value.strip().split()
    if len(parts) != 3:
        raise ValueError(f"Не удалось распарсить дату: {value}")
    day = int(parts[0])
    month_key = parts[1][:3].lower()
    month = MONTHS_MAP.get(month_key)
    if not month:
        raise ValueError(f"Неизвестный месяц: {parts[1]} ({value})")
    year = int(parts[2])
    return date(year, month, day)


def combine_datetime(date_str: str, time_str: str) -> datetime:
    """Соединить дату и время в datetime."""
    base_date = parse_russian_date(date_str)
    hours, minutes = map(int, time_str.split(":"))
    return datetime(base_date.year, base_date.month, base_date.day, hours, minutes)


ATHLETES_DATA = [
    {
        "name": "Алексей Смирнов",
        "birth_date": date(2000, 5, 15),
        "email": "alex.smirnov@mail.ru",
        "phone": "+7 (999) 123-45-67",
        "contact_info": {
            "telegram": "@alex_smirnov",
            "avatar": "АС",
            "sport": "Бокс",
            "status": "active",
            "next_session": "2024-12-15T10:00:00",
            "attendance": 92,
        },
        "notes": "Фокус на силовой подготовке",
    },
    {
        "name": "Мария Иванова",
        "birth_date": date(2002, 3, 8),
        "email": "maria.ivanova@mail.ru",
        "phone": "+7 (999) 234-56-78",
        "contact_info": {
            "telegram": "@maria_runner",
            "avatar": "МИ",
            "sport": "Легкая атлетика",
            "status": "active",
            "next_session": "2024-12-15T12:00:00",
            "attendance": 88,
        },
        "notes": "Специализация - средние дистанции",
    },
    {
        "name": "Дмитрий Козлов",
        "birth_date": date(1996, 9, 21),
        "email": "dmitry.kozlov@mail.ru",
        "phone": "+7 (999) 345-67-89",
        "contact_info": {
            "telegram": "@dmitry_crossfit",
            "avatar": "ДК",
            "sport": "Кроссфит",
            "status": "warning",
            "next_session": "2024-12-16T12:00:00",
            "attendance": 65,
        },
        "notes": "Восстановление после травмы",
    },
    {
        "name": "Елена Петрова",
        "birth_date": date(1998, 7, 3),
        "email": "elena.petrova@mail.ru",
        "phone": "+7 (999) 456-78-90",
        "contact_info": {
            "telegram": "@elena_swim",
            "avatar": "ЕП",
            "sport": "Плавание",
            "status": "active",
            "next_session": "2024-12-15T16:00:00",
            "attendance": 95,
        },
        "notes": "Подготовка к зимнему чемпионату",
    },
    {
        "name": "Иван Соколов",
        "birth_date": date(1994, 1, 30),
        "email": "ivan.sokolov@mail.ru",
        "phone": "+7 (999) 567-89-01",
        "contact_info": {
            "telegram": "@ivan_box",
            "avatar": "ИС",
            "sport": "Бокс",
            "status": "inactive",
            "next_session": None,
            "attendance": 45,
        },
        "notes": "На восстановлении",
    },
    {
        "name": "Анна Волкова",
        "birth_date": date(2001, 11, 18),
        "email": "anna.volkova@mail.ru",
        "phone": "+7 (999) 678-90-12",
        "contact_info": {
            "telegram": "@anna_track",
            "avatar": "АВ",
            "sport": "Легкая атлетика",
            "status": "active",
            "next_session": "2024-12-16T10:00:00",
            "attendance": 90,
        },
        "notes": "Специализация - спринт",
    },
]


TRAINING_PLANS_DATA = [
    {
        "name": "Силовая программа - Начинающие",
        "description": "Базовая силовая программа на 8 недель",
        "weeks": 8,
        "plan_data": {
            "sessions": 24,
            "athletes": 12,
            "type": "Силовая",
            "status": "active",
            "last_updated": "2024-12-10",
        },
    },
    {
        "name": "Кардио-выносливость",
        "description": "Интенсивная кардио программа для повышения выносливости",
        "weeks": 6,
        "plan_data": {
            "sessions": 18,
            "athletes": 8,
            "type": "Кардио",
            "status": "active",
            "last_updated": "2024-12-08",
        },
    },
    {
        "name": "Функциональный тренинг",
        "description": "Подготовка функциональных групп",
        "weeks": 12,
        "plan_data": {
            "sessions": 36,
            "athletes": 15,
            "type": "Функциональная",
            "status": "active",
            "last_updated": "2024-12-05",
        },
    },
    {
        "name": "Подготовка к соревнованиям",
        "description": "Специальная программа перед стартом",
        "weeks": 10,
        "plan_data": {
            "sessions": 40,
            "athletes": 5,
            "type": "Специальная",
            "status": "draft",
            "last_updated": "2024-12-01",
        },
    },
]


WORKOUTS_DATA = [
    {
        "session_name": "Силовая тренировка - Группа А",
        "date": "15 дек 2024",
        "time": "10:00",
        "location": "Зал 1",
        "group_name": "Группа А",
        "athlete_count": 12,
        "exercise_count": 8,
        "status": "completed",
        "training_plan": "Силовая программа - Начинающие",
    },
    {
        "session_name": "Кардио (Индивидуально)",
        "date": "15 дек 2024",
        "time": "14:00",
        "location": "Беговая дорожка",
        "group_name": "Индивидуальная",
        "athlete_count": 1,
        "exercise_count": 5,
        "status": "completed",
        "training_plan": "Кардио-выносливость",
    },
    {
        "session_name": "Функциональная - Группа Б",
        "date": "16 дек 2024",
        "time": "12:00",
        "location": "Зал 2",
        "group_name": "Группа Б",
        "athlete_count": 15,
        "exercise_count": 10,
        "status": "completed",
        "training_plan": "Функциональный тренинг",
    },
    {
        "session_name": "Техника - Юниоры",
        "date": "16 дек 2024",
        "time": "16:00",
        "location": "Зал 3",
        "group_name": "Юниоры",
        "athlete_count": 8,
        "exercise_count": 6,
        "status": "upcoming",
        "training_plan": "Подготовка к соревнованиям",
    },
    {
        "session_name": "Силовая - Группа А",
        "date": "17 дек 2024",
        "time": "10:00",
        "location": "Зал 1",
        "group_name": "Группа А",
        "athlete_count": 12,
        "exercise_count": 8,
        "status": "upcoming",
        "training_plan": "Силовая программа - Начинающие",
    },
]


ATTENDANCE_DATA = [
    {"athlete": "Алексей Смирнов", "workout": "Силовая тренировка - Группа А", "status": "present"},
    {"athlete": "Мария Иванова", "workout": "Силовая тренировка - Группа А", "status": "present"},
    {"athlete": "Дмитрий Козлов", "workout": "Силовая тренировка - Группа А", "status": "late"},
    {"athlete": "Елена Петрова", "workout": "Силовая тренировка - Группа А", "status": "present"},
    {"athlete": "Иван Соколов", "workout": "Силовая тренировка - Группа А", "status": "absent"},
    {"athlete": "Анна Волкова", "workout": "Силовая тренировка - Группа А", "status": "present"},
]


INJURIES_DATA = [
    {
        "athlete": "Дмитрий Козлов",
        "title": "Растяжение связок голеностопа",
        "description": "Получена травма во время тренировки. Рекомендован покой 2 недели.",
        "date": "10 дек 2024",
        "severity": "moderate",
        "recovery_time": 14,
        "medical_notes": "Использует тейпирование",
        "status": "active",
    },
    {
        "athlete": "Иван Соколов",
        "title": "Хроническая астма",
        "description": "Требует контроля нагрузок, наличие ингалятора обязательно.",
        "date": "01 ноя 2024",
        "severity": "severe",
        "recovery_time": None,
        "medical_notes": "Еженедельный контроль",
        "status": "monitoring",
    },
    {
        "athlete": "Елена Петрова",
        "title": "Плановый медосмотр",
        "description": "Все показатели в норме. Допуск к тренировкам.",
        "date": "15 дек 2024",
        "severity": "minor",
        "recovery_time": 0,
        "medical_notes": "Следующий осмотр 15 мар 2025",
        "status": "completed",
    },
    {
        "athlete": "Алексей Смирнов",
        "title": "Ушиб ребра",
        "description": "Восстановление прошло успешно. Возврат к полным нагрузкам.",
        "date": "28 ноя 2024",
        "severity": "moderate",
        "recovery_time": 21,
        "medical_notes": "Рекомендован контроль нагрузки",
        "status": "recovered",
    },
    {
        "athlete": "Мария Иванова",
        "title": "Пониженный гемоглобин",
        "description": "Рекомендована корректировка питания и прием препаратов железа.",
        "date": "05 дек 2024",
        "severity": "minor",
        "recovery_time": None,
        "medical_notes": "Контроль 20 дек 2024",
        "status": "monitoring",
    },
]


NUTRITION_PLANS_DATA = [
    {
        "athlete": "Алексей Смирнов",
        "plan_type": "bulking",
        "plan_name": "План набора мышечной массы",
        "calories": 3200,
        "macros": {"protein": 180, "carbs": 400, "fats": 90},
        "meals": [
            {"time": "07:00", "items": "Овсянка, яйца, фрукты"},
            {"time": "10:00", "items": "Орехи, йогурт"},
            {"time": "13:00", "items": "Курица, рис, овощи"},
            {"time": "16:00", "items": "Протеиновый коктейль"},
            {"time": "19:00", "items": "Рыба, гречка, салат"},
            {"time": "21:00", "items": "Творог"},
        ],
        "restrictions": "Нет",
        "compliance": 92,
        "current_weight": 82,
        "target_weight": 85,
        "progress": "+2 кг",
    },
    {
        "athlete": "Мария Иванова",
        "plan_type": "endurance",
        "plan_name": "План для выносливости",
        "calories": 2800,
        "macros": {"protein": 140, "carbs": 350, "fats": 80},
        "meals": [],
        "restrictions": "Повышенное потребление железа",
        "compliance": 88,
        "current_weight": 58,
        "target_weight": 58,
        "progress": "Стабильно",
    },
    {
        "athlete": "Дмитрий Козлов",
        "plan_type": "cutting",
        "plan_name": "План снижения веса",
        "calories": 2000,
        "macros": {"protein": 150, "carbs": 180, "fats": 60},
        "meals": [],
        "restrictions": "Ограничение сахара",
        "compliance": 65,
        "current_weight": 95,
        "target_weight": 90,
        "progress": "-1 кг",
    },
    {
        "athlete": "Елена Петрова",
        "plan_type": "endurance",
        "plan_name": "План для выносливости",
        "calories": 2600,
        "macros": {"protein": 135, "carbs": 320, "fats": 75},
        "meals": [],
        "restrictions": "Без ограничений",
        "compliance": 95,
        "current_weight": 62,
        "target_weight": 62,
        "progress": "Стабильно",
    },
]


REPORTS_DATA = [
    {
        "type": ReportType.ATTENDANCE.value,
        "title": "Attendance Report December",
        "data": {
            "total_workouts": 25,
            "present": 92,
            "absent": 6,
            "late": 2,
            "attendance_rate": 93.5,
        },
    },
    {
        "type": ReportType.PROGRESS.value,
        "title": "Progress Overview Q4",
        "data": {
            "athletes": 6,
            "improving": 4,
            "stable": 1,
            "regressing": 1,
        },
    },
    {
        "type": ReportType.INJURIES.value,
        "title": "Injury Summary",
        "data": {
            "total_injuries": 5,
            "active": 1,
            "monitoring": 2,
            "recovered": 1,
            "completed": 1,
        },
    },
]


def seed_users(session: SessionLocal):
    if session.query(User).count():
        print("Users already exist, skipping seeding.")
        return

    for data in USERS_DATA:
        user = User(
            email=data["email"],
            full_name=data["full_name"],
            hashed_password=get_password_hash(data["password"]),
            is_active=True,
        )
        session.add(user)

    session.commit()


def seed_athletes(session: SessionLocal) -> Dict[str, Athlete]:
    if session.query(Athlete).count():
        print("Athletes already exist, skipping seeding.")
        return {athlete.name: athlete for athlete in session.query(Athlete).all()}

    created = {}
    for data in ATHLETES_DATA:
        athlete = Athlete(
            name=data["name"],
            photo=None,
            contact_info=json.dumps(data["contact_info"]),
            birth_date=data["birth_date"],
            email=data["email"],
            phone=data["phone"],
            address=None,
            notes=data["notes"],
            # Дополнительные поля сохраняем через notes/доп. информацию
        )
        session.add(athlete)
        session.flush()
        created[data["name"]] = athlete

    session.commit()
    return created


def seed_training_plans(session: SessionLocal) -> Dict[str, TrainingPlan]:
    if session.query(TrainingPlan).count():
        print("Training plans already exist, skipping seeding.")
        return {plan.name: plan for plan in session.query(TrainingPlan).all()}

    created = {}
    for data in TRAINING_PLANS_DATA:
        plan = TrainingPlan(
            name=data["name"],
            description=data["description"],
            weeks=data["weeks"],
            plan_data=json.dumps(data["plan_data"]),
        )
        session.add(plan)
        session.flush()
        created[data["name"]] = plan

    session.commit()
    return created


def seed_workouts(session: SessionLocal, plan_map: Dict[str, TrainingPlan]) -> Dict[str, Workout]:
    if session.query(Workout).count():
        print("Workouts already exist, skipping seeding.")
        return {workout.description: workout for workout in session.query(Workout).all()}

    created = {}
    for data in WORKOUTS_DATA:
        plan = plan_map.get(data["training_plan"])
        workout_datetime = combine_datetime(data["date"], data["time"])
        workout = Workout(
            date=workout_datetime,
            time=data["time"],
            location=data["location"],
            description=data["session_name"],
            training_plan_id=plan.id if plan else None,
        )
        session.add(workout)
        session.flush()
        created[data["session_name"]] = workout

    session.commit()
    return created


def seed_training_plan_assignments(session: SessionLocal, plan_map: Dict[str, TrainingPlan], athlete_map: Dict[str, Athlete]):
    if session.query(TrainingPlanAssignment).count():
        print("Plan assignments already exist, skipping seeding.")
        return

    assignments = [
        ("Алексей Смирнов", "Силовая программа - Начинающие", datetime(2024, 12, 1, 0, 0)),
        ("Мария Иванова", "Кардио-выносливость", datetime(2024, 12, 1, 0, 0)),
        ("Дмитрий Козлов", "Функциональный тренинг", datetime(2024, 12, 1, 0, 0)),
        ("Елена Петрова", "Подготовка к соревнованиям", datetime(2024, 12, 1, 0, 0)),
    ]

    for athlete_name, plan_name, start in assignments:
        athlete = athlete_map.get(athlete_name)
        plan = plan_map.get(plan_name)
        if not athlete or not plan:
            continue
        session.add(
            TrainingPlanAssignment(
                athlete_id=athlete.id,
                training_plan_id=plan.id,
                start_date=start,
            )
        )

    session.commit()


def seed_attendance(session: SessionLocal, athlete_map: Dict[str, Athlete], workout_map: Dict[str, Workout]):
    if session.query(Attendance).count():
        print("Attendance records already exist, skipping seeding.")
        return

    for record in ATTENDANCE_DATA:
        athlete = athlete_map.get(record["athlete"])
        workout = workout_map.get(record["workout"])
        if not athlete or not workout:
            continue
        attendance = Attendance(
            athlete_id=athlete.id,
            workout_id=workout.id,
            status=record["status"],
            notes=None,
        )
        session.add(attendance)

    session.commit()


def seed_injuries(session: SessionLocal, athlete_map: Dict[str, Athlete]):
    if session.query(Injury).count():
        print("Injuries already exist, skipping seeding.")
        return

    for data in INJURIES_DATA:
        athlete = athlete_map.get(data["athlete"])
        if not athlete:
            continue
        injury = Injury(
            athlete_id=athlete.id,
            description=data["description"],
            date=parse_russian_date(data["date"]),
            severity=data["severity"],
            recovery_time=data["recovery_time"],
            medical_notes=data["medical_notes"],
            status=data["status"],
        )
        session.add(injury)

    session.commit()


def seed_nutrition_plans(session: SessionLocal, athlete_map: Dict[str, Athlete]):
    if session.query(NutritionPlan).count():
        print("Nutrition plans already exist, skipping seeding.")
        return

    for data in NUTRITION_PLANS_DATA:
        athlete = athlete_map.get(data["athlete"])
        if not athlete:
            continue
        plan = NutritionPlan(
            athlete_id=athlete.id,
            plan_type=data["plan_type"],
            meals=json.dumps(data["meals"]),
            restrictions=data["restrictions"],
            calories=data["calories"],
            macros=json.dumps(data["macros"]),
            start_date=datetime(2024, 12, 1, 0, 0),
            end_date=datetime(2025, 1, 31, 0, 0),
        )
        session.add(plan)

    session.commit()


def seed_reports(session: SessionLocal):
    if session.query(Report).count():
        print("Reports already exist, skipping seeding.")
        return

    for data in REPORTS_DATA:
        report = Report(
            type=data["type"],
            title=data["title"],
            data=json.dumps(data["data"]),
            parameters=json.dumps({"source": "seed"}),
        )
        session.add(report)

    session.commit()


def run_seed():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        seed_users(session)
        ensure_default_rbac(session)
        athlete_map = seed_athletes(session)
        plan_map = seed_training_plans(session)
        workout_map = seed_workouts(session, plan_map)
        seed_training_plan_assignments(session, plan_map, athlete_map)
        seed_attendance(session, athlete_map, workout_map)
        seed_injuries(session, athlete_map)
        seed_nutrition_plans(session, athlete_map)
        seed_reports(session)
        print("Seeding completed.")
    finally:
        session.close()


if __name__ == "__main__":
    run_seed()


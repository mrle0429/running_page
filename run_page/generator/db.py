import datetime
import json
import os
import urllib.parse
import urllib.request

from sqlalchemy import (
    Column,
    Float,
    Integer,
    Interval,
    String,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

Base = declarative_base()


GEOCODE_CACHE_FILE = os.getenv(
    "GEOCODE_CACHE_FILE",
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.realpath(__file__))),
        "location_cache.json",
    ),
)
GEOCODE_TIMEOUT = int(os.getenv("GEOCODE_TIMEOUT", "10"))
GEOCODE_COORD_PRECISION = int(os.getenv("GEOCODE_COORD_PRECISION", "3"))
AMAP_REGEOCODE_URL = "https://restapi.amap.com/v3/geocode/regeo"


def load_location_cache():
    if not os.path.exists(GEOCODE_CACHE_FILE):
        return {}
    try:
        with open(GEOCODE_CACHE_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Unable to load location cache {GEOCODE_CACHE_FILE}: {e}")
        return {}


def save_location_cache(cache):
    try:
        with open(GEOCODE_CACHE_FILE, "w") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2, sort_keys=True)
    except Exception as e:
        print(f"Unable to save location cache {GEOCODE_CACHE_FILE}: {e}")


LOCATION_CACHE = load_location_cache()


def geocode_cache_key(start_point):
    return (
        f"{round(float(start_point.lat), GEOCODE_COORD_PRECISION)},"
        f"{round(float(start_point.lon), GEOCODE_COORD_PRECISION)}"
    )


def reverse_location(start_point):
    if not start_point:
        return ""

    cache_key = geocode_cache_key(start_point)
    cached = LOCATION_CACHE.get(cache_key)
    if cached:
        return cached

    amap_key = os.getenv("AMAP_KEY", "")
    if not amap_key:
        print("Unable to reverse geocode: AMAP_KEY is not set")
        return ""

    lng, lat = start_point.lon, start_point.lat
    try:
        import eviltransform

        if not eviltransform.outOfChina(lat, lng):
            lat, lng = eviltransform.wgs2gcj(lat, lng)
    except Exception as e:
        print(f"Unable to transform coordinate {start_point.lat}, {start_point.lon}: {e}")

    query = urllib.parse.urlencode(
        {
            "key": amap_key,
            "location": f"{lng},{lat}",
            "extensions": "base",
            "radius": 1000,
            "output": "json",
        }
    )
    try:
        with urllib.request.urlopen(
            f"{AMAP_REGEOCODE_URL}?{query}", timeout=GEOCODE_TIMEOUT
        ) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"Unable to reverse geocode {start_point.lat}, {start_point.lon}: {e}")
        return ""

    if data.get("status") != "1":
        print(
            "Unable to reverse geocode "
            f"{start_point.lat}, {start_point.lon}: "
            f"{data.get('info', 'unknown error')}"
        )
        return ""

    regeocode = data.get("regeocode") or {}
    address_component = regeocode.get("addressComponent") or {}
    location_parts = [
        regeocode.get("formatted_address", ""),
        address_component.get("district", ""),
        address_component.get("city", ""),
        address_component.get("province", ""),
        address_component.get("country", ""),
    ]
    location_text = ", ".join(
        dict.fromkeys([str(part) for part in location_parts if part])
    )
    if location_text:
        LOCATION_CACHE[cache_key] = location_text
        save_location_cache(LOCATION_CACHE)
    return location_text


ACTIVITY_KEYS = [
    "run_id",
    "name",
    "distance",
    "moving_time",
    "type",
    "subtype",
    "start_date",
    "start_date_local",
    "location_country",
    "summary_polyline",
    "average_heartrate",
    "average_speed",
    "elevation_gain",
]


class Activity(Base):
    __tablename__ = "activities"

    run_id = Column(Integer, primary_key=True)
    name = Column(String)
    distance = Column(Float)
    moving_time = Column(Interval)
    elapsed_time = Column(Interval)
    type = Column(String)
    subtype = Column(String)
    start_date = Column(String)
    start_date_local = Column(String)
    location_country = Column(String)
    summary_polyline = Column(String)
    average_heartrate = Column(Float)
    average_speed = Column(Float)
    elevation_gain = Column(Float)
    streak = None

    def to_dict(self):
        out = {}
        for key in ACTIVITY_KEYS:
            attr = getattr(self, key)
            if isinstance(attr, (datetime.timedelta, datetime.datetime)):
                out[key] = str(attr)
            else:
                out[key] = attr

        if self.streak:
            out["streak"] = self.streak

        return out


def update_or_create_activity(session, run_activity):
    created = False
    try:
        activity = (
            session.query(Activity).filter_by(run_id=int(run_activity.id)).first()
        )

        current_elevation_gain = 0.0  # default value

        # https://github.com/stravalib/stravalib/blob/main/src/stravalib/strava_model.py#L639C1-L643C41
        if (
            hasattr(run_activity, "total_elevation_gain")
            and run_activity.total_elevation_gain is not None
        ):
            current_elevation_gain = float(run_activity.total_elevation_gain)
        elif (
            hasattr(run_activity, "elevation_gain")
            and run_activity.elevation_gain is not None
        ):
            current_elevation_gain = float(run_activity.elevation_gain)

        if not activity:
            start_point = run_activity.start_latlng
            location_country = getattr(run_activity, "location_country", "")
            # or China for #176 to fix
            if (not location_country and start_point) or location_country == "China":
                location_country = reverse_location(start_point)

            activity = Activity(
                run_id=run_activity.id,
                name=run_activity.name,
                distance=run_activity.distance,
                moving_time=run_activity.moving_time,
                elapsed_time=run_activity.elapsed_time,
                type=run_activity.type,
                subtype=run_activity.subtype,
                start_date=run_activity.start_date,
                start_date_local=run_activity.start_date_local,
                location_country=location_country,
                average_heartrate=run_activity.average_heartrate,
                average_speed=float(run_activity.average_speed),
                elevation_gain=current_elevation_gain,
                summary_polyline=(
                    run_activity.map and run_activity.map.summary_polyline or ""
                ),
            )
            session.add(activity)
            created = True
        else:
            start_point = run_activity.start_latlng
            if (
                (not activity.location_country or activity.location_country == "China")
                and start_point
            ):
                activity.location_country = reverse_location(start_point)
            activity.name = run_activity.name
            activity.distance = float(run_activity.distance)
            activity.moving_time = run_activity.moving_time
            activity.elapsed_time = run_activity.elapsed_time
            activity.type = run_activity.type
            activity.subtype = run_activity.subtype
            activity.average_heartrate = run_activity.average_heartrate
            activity.average_speed = float(run_activity.average_speed)
            activity.elevation_gain = current_elevation_gain
            activity.summary_polyline = (
                run_activity.map and run_activity.map.summary_polyline or ""
            )
    except Exception as e:
        print(f"something wrong with {run_activity.id}")
        print(str(e))

    return created


def add_missing_columns(engine, model):
    inspector = inspect(engine)
    table_name = model.__tablename__
    columns = {col["name"] for col in inspector.get_columns(table_name)}
    missing_columns = []

    for column in model.__table__.columns:
        if column.name not in columns:
            missing_columns.append(column)
    if missing_columns:
        with engine.connect() as conn:
            for column in missing_columns:
                column_type = str(column.type)
                conn.execute(
                    text(
                        f"ALTER TABLE {table_name} ADD COLUMN {column.name} {column_type}"
                    )
                )


def init_db(db_path):
    engine = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)

    # check missing columns
    add_missing_columns(engine, Activity)

    sm = sessionmaker(bind=engine)
    session = sm()
    # apply the changes
    session.commit()
    return session

import datetime as dt
import re
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

# SQLite drops timezone info; all stored timestamps are UTC, so mark them as UTC when sending them out.
UtcDatetime = Annotated[
    dt.datetime, AfterValidator(lambda v: v.replace(tzinfo=dt.timezone.utc) if v.tzinfo is None else v)
]

PlayingLevel = Literal["Beginner", "Intermediate", "Advanced"]
MainGoal = Literal["Stamina", "Footwork", "Strength", "Technique", "Match performance", "General fitness"]
InjuryStatus = Literal["None", "Recovering", "Current"]
DietType = Literal["Vegetarian", "Non-vegetarian", "Vegan", "Eggetarian"]
Gender = Literal["Male", "Female", "Other", "Prefer not to say"]
TrainingType = Literal["Footwork", "Strength", "Endurance", "Technique", "Match practice", "Recovery"]
MatchFormat = Literal["Singles", "Doubles"]


# ---------- auth ----------

class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # bcrypt only uses the first 72 bytes


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeOut(BaseModel):
    id: int
    email: str
    name: str | None
    profile_complete: bool
    is_demo: bool


class DemoStatus(BaseModel):
    enabled: bool
    name: str


# ---------- profile ----------

class ProfileIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=10, le=90)
    gender: Gender
    height_cm: float = Field(ge=100, le=250)
    weight_kg: float = Field(ge=25, le=200)
    playing_level: PlayingLevel
    main_goal: MainGoal
    injury_status: InjuryStatus = "None"
    injury_body_part: str | None = Field(default=None, max_length=60)
    pain_level: int = Field(default=0, ge=0, le=10)
    diet_type: DietType

    @model_validator(mode="after")
    def injury_fields_consistent(self):
        if self.injury_status == "None":
            self.injury_body_part = None
            self.pain_level = 0
        elif not (self.injury_body_part or "").strip():
            raise ValueError("Please tell us which body part is injured.")
        return self


class ProfileOut(ProfileIn):
    model_config = ConfigDict(from_attributes=True)


# ---------- training ----------

class TrainingIn(BaseModel):
    date: dt.date
    type: TrainingType
    duration_min: int = Field(ge=5, le=480)
    rpe: int = Field(ge=1, le=10, description="Session effort, 1 = very easy, 10 = maximal")
    notes: str = Field(default="", max_length=1000)


class TrainingOut(TrainingIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    load: int  # session-RPE load = duration x RPE


# ---------- matches ----------

GAME_RE = re.compile(r"^\s*(\d{1,2})\s*-\s*(\d{1,2})\s*$")


def parse_game_scores(raw: str) -> list[tuple[int, int]]:
    """Parse "21-18, 19-21" into [(21, 18), (19, 21)] (player's points first)."""
    games = []
    for part in raw.split(","):
        if not part.strip():
            continue
        m = GAME_RE.match(part)
        if not m:
            raise ValueError(f"'{part.strip()}' is not a score like 21-18.")
        mine, theirs = int(m.group(1)), int(m.group(2))
        if mine > 30 or theirs > 30 or mine == theirs:
            raise ValueError(f"'{part.strip()}' is not a valid badminton game score.")
        games.append((mine, theirs))
    if not 1 <= len(games) <= 3:
        raise ValueError("Enter between 1 and 3 game scores, e.g. 21-18, 19-21, 21-15.")
    return games


def match_result(games: list[tuple[int, int]]) -> str:
    won = sum(1 for a, b in games if a > b)
    lost = len(games) - won
    return "Win" if won > lost else "Loss" if lost > won else "Draw"


class MatchIn(BaseModel):
    date: dt.date
    opponent: str = Field(min_length=1, max_length=100)
    format: MatchFormat
    game_scores: str
    self_rating: int = Field(ge=1, le=10)
    notes: str = Field(default="", max_length=1000)

    @field_validator("game_scores")
    @classmethod
    def normalise_scores(cls, v: str) -> str:
        games = parse_game_scores(v)
        won = lost = 0
        for a, b in games:
            if won == 2 or lost == 2:
                raise ValueError("The match was already decided before the last game - remove the extra game.")
            won, lost = won + (a > b), lost + (b > a)
        if 2 not in (won, lost):
            raise ValueError("A best-of-3 match needs a winner (2 games). Add the deciding game score.")
        return ",".join(f"{a}-{b}" for a, b in games)


class MatchOut(MatchIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    result: str
    games_won: int
    games_lost: int
    points_won: int
    points_lost: int


# ---------- check-ins ----------

class CheckinIn(BaseModel):
    date: dt.date
    sleep_hours: float = Field(ge=0, le=16)
    energy: int = Field(ge=1, le=10)
    soreness: int = Field(ge=1, le=10)
    stress: int = Field(ge=1, le=10)
    water_l: float = Field(ge=0, le=10)
    notes: str = Field(default="", max_length=1000)


class CheckinOut(CheckinIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    score: int  # 0-100 wellness score, see app.services.stats.wellness_score
    label: str


# ---------- chat / plans ----------

class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class Source(BaseModel):
    ref: int
    title: str
    section: str
    doc_id: str


class ChatOut(BaseModel):
    answer: str
    sources: list[Source]
    safety_flag: bool


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    role: str
    content: str
    sources: list[Source]
    safety_flag: bool
    created_at: UtcDatetime


class PlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    plan: dict
    sources: list[Source]
    created_at: UtcDatetime

from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseSettings):
    # Database
    mongo_url: str=os.getenv("MONGO_URL")
    mongo_db: str=os.getenv("MONGO_DB")
    
    # JWT
    jwt_secret: str = "your-secret-key"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    
    # Password
    hashing_algorithm: str = "bcrypt"
    hashing_rounds: int = 12
    
    # CORS
    cors_origins: str = "http://localhost:5175"
    
    # Environment
    app_env: str = "development"
    app_debug: bool = True
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    
    # Logging
    log_level: str = "INFO"

    #RCS
    ics_host: str = "192.168.1.100"
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"

settings = Settings()

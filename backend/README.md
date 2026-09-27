# FastAPI Modular Template

A best-practice FastAPI framework template designed for rapid module development and integration.

## 🚀 Features

- **Modular Architecture**: Clean separation of concerns with routers, models, and services
- **Injection Points**: Easy module integration with marked injection points
- **Configuration Management**: Environment-based configuration with Pydantic Settings
- **Development Ready**: Pre-configured with CORS, testing, and development tools

## 📁 Project Structure

```
backend/
├── main.py                # FastAPI app with MODULE_ injection points
├── requirements.txt       # Python dependencies
├── .env.example           # Environment variables template
├── core/
│   ├── __init__.py
│   └── config.py          # Pydantic settings with MODULE_CONFIG injection
├── routers/               # API route handlers
│   ├── __init__.py
├── models/                # Database and Pydantic data models
│   ├── __init__.py
├── services/              # Business logic services
│   ├── __init__.py
├── dependencies/          # Dependency injection modules
│   ├── __init__.py
├── middlewares/           # Custom middleware components
│   ├── __init__.py
├── schemas/               # Pydantic request/response models
│   ├── __init__.py
├── tests/                 # Test files
│   ├── __init__.py
│   ├── conftest.py        # Pytest configuration
│   └── test_main.py       # Main app tests
└── utils/                 # Utility functions
    ├── __init__.py
```

## 🛠 Quick Start

1. **Install Dependencies**

   ```bash
   pip install -r requirements.txt
   ```

2. **Configure Environment**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Run the Server**

   ```bash
   python main.py
   ```

4. **Test the API**
   ```bash
   curl http://localhost:8000/health
   ```

## 🔌 Module Injection Points

This template includes predefined injection points for easy module integration. All injection points use the `MODULE_` prefix for easy identification:

### main.py

```python
# MODULE_IMPORTS_START
# Module imports will be injected here
# MODULE_IMPORTS_END

@asynccontextmanager
async def lifespan(app: FastAPI):
    # MODULE_STARTUP_START
    # Module startup code will be injected here
    # MODULE_STARTUP_END
    yield
    # MODULE_SHUTDOWN_START
    # Module shutdown code will be injected here
    # MODULE_SHUTDOWN_END

# MODULE_MIDDLEWARE_START
# Module middleware will be injected here
# MODULE_MIDDLEWARE_END

# MODULE_ROUTERS_START
# Module routers will be injected here
# MODULE_ROUTERS_END
```

### core/config.py

```python
class Settings(BaseSettings):
    # ... existing settings ...

    # MODULE_CONFIG_START
    # Module configuration will be injected here
    # MODULE_CONFIG_END
```

## 📦 Module Integration

To integrate modules with this template:

1. **Use the module manager**:

   ```bash
   python manager.py install base <module-name>
   ```

2. **Manual integration** (modules automatically handle these):
   - Add imports to `MODULE_IMPORTS` section
   - Add startup/shutdown logic to respective sections
   - Add configuration to `MODULE_CONFIG` section
   - Add routers and middleware to respective sections

## 🧪 Testing

The tests run against a separate PostgreSQL database, `amanah_giving_test`, which is emptied
before every test (never point them at the real database). Create it once:

```bash
docker exec amanah_postgres psql -U amanah -d amanah_giving -c "create database amanah_giving_test"
```

Then, from the `backend` folder:

```bash
venv\Scripts\python.exe -m pytest        # Windows
venv/bin/python -m pytest                # Linux / macOS
```

Stripe, PayDunya and email sending are replaced by fakes: no network call, no real payment,
no email. `TEST_DATABASE_URL` selects another test database (its name must end with `_test`).

- `tests/test_auth.py`: accounts, login lock, sliding sessions, password reset, CSRF
- `tests/test_payments.py`: donations, Stripe and PayDunya confirmation, project totals, statistics
- `tests/test_access.py`: what visitors, users and administrators may do

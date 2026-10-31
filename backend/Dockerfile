# Gateway WisiVoz (FastAPI) + webapp móvil de Wisi.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv

COPY pyproject.toml ./
RUN pip install --no-cache-dir "fastapi>=0.115" "uvicorn[standard]>=0.32" "pydantic>=2.9" "httpx>=0.27" "python-dotenv>=1.0"

COPY app ./app

RUN useradd --system --uid 10001 wisi
USER wisi

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/health')"
# Un solo worker: el ledger simulado vive en memoria.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]

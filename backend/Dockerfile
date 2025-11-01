FROM python:3.12.2-bookworm
ARG NB_USER=appuser
ARG NB_UID=1000
ARG NB_GID=1000
RUN groupadd -g ${NB_GID} ${NB_USER} && \
    useradd -l -m -s /bin/bash -g ${NB_GID} -u ${NB_UID} ${NB_USER}
WORKDIR /app
RUN chown ${NB_USER}:${NB_USER} /app
USER ${NB_USER}
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
USER ${NB_USER}
RUN pip install --no-cache-dir poetry
COPY pyproject.toml poetry.lock ./
COPY . .
EXPOSE 8000
CMD ["poetry", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]


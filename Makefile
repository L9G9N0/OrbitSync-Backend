# Makefile for BlackHole Storage Engine Control

.PHONY: all bootstrap run daemon clean

all: run

bootstrap:
	@echo "Creating Python virtual environment and installing dependencies..."
	python3 -m venv venv
	./venv/bin/pip install --upgrade pip
	./venv/bin/pip install -r requirements.txt
	@echo "Setup complete. Create a .env file based on settings requirements."

run:
	@echo "Starting FastAPI Uvicorn Server on http://127.0.0.1:8000..."
	./venv/bin/uvicorn app.main:app --reload

daemon:
	@echo "Starting local sync daemon monitoring ~/BlackHole_Sync..."
	./venv/bin/python daemon/sync_daemon.py

clean:
	@echo "Cleaning up python caches..."
	rm -rf __pycache__ app/__pycache__ app/core/__pycache__
	rm -f *.pyc app/*.pyc app/core/*.pyc
	@echo "Clean complete."

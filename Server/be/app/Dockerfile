# 1. Use an official, lightweight Python image
FROM python:3.13-slim

# 2. Set the working directory inside the container
WORKDIR /code

# 3. Copy only the requirements first (to cache this step)
COPY ./requirements.txt /code/requirements.txt

# 4. Install dependencies
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# 5. Copy the rest of the application code
COPY ./app /code/app

# 6. Expose the port the app runs on
EXPOSE 6868

# 7. Start the Uvicorn server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "6868"]
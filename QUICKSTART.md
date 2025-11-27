# Quick Start Guide

## Installation

```bash
npm install
npm run build
```

## Starting the Server

```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in `PORT` environment variable).

## Basic Usage

### 1. Create a scraping job

```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{"fields": ["title", "price"]}'
```

### 2. Scrape a website

```bash
curl -X POST http://localhost:3000/jobs/1/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "fields": ["title", "price"]}'
```

### 3. Get results

```bash
curl http://localhost:3000/jobs/1
```

### 4. List all jobs

```bash
curl http://localhost:3000/jobs
```

### 5. Delete a job

```bash
curl -X DELETE http://localhost:3000/jobs/1
```

## Full Documentation

- [API.md](API.md) - Complete API documentation
- [EXAMPLE.md](EXAMPLE.md) - Real-world example with product scraping

## How It Works

1. Define fields you want to extract (e.g., "title", "price")
2. Provide a URL to scrape
3. LLM analyzes HTML and generates XPath expressions
4. Data is extracted and stored in SQLite
5. Query results via REST API

No manual XPath writing required!

# GitMCP Docker Setup

This directory contains the Docker configuration for running GitMCP as a standalone server.

## Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 2.0 or higher)

## Quick Start

### 1. Build and Run with Docker Compose

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

The application will be available at `http://localhost:5173`

### 2. Using Environment Variables

Create a `.env` file in the root directory to configure API keys:

```bash
# .env file
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GROQ_API_KEY=gsk_your-groq-key
XAI_API_KEY=xai-your-xai-key
```

Then start the container:

```bash
docker-compose up -d
```

### 3. Build Docker Image Manually

```bash
# Build the image
docker build -t gitmcp:latest .

# Run the container
docker run -d \
  --name gitmcp \
  -p 5173:5173 \
  -e OPENAI_API_KEY=your-key \
  gitmcp:latest
```

## Configuration

### Port Configuration

By default, the application runs on port `5173`. To change this:

1. Update `docker-compose.yml`:
```yaml
ports:
  - "8080:5173"  # Maps host port 8080 to container port 5173
```

2. Or use environment variables:
```bash
docker-compose up -d --build
```

### Environment Variables

The following environment variables can be configured:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `production` |
| `HOST` | Server host | `0.0.0.0` |
| `PORT` | Server port | `5173` |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `GROQ_API_KEY` | Groq API key | - |
| `XAI_API_KEY` | XAI API key | - |

### Volume Mounts

Persistent data is stored in the `gitmcp-data` volume. To backup or restore data:

```bash
# Backup
docker run --rm -v gitmcp-data:/data -v $(pwd):/backup alpine tar czf /backup/gitmcp-backup.tar.gz -C /data .

# Restore
docker run --rm -v gitmcp-data:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzf /backup/gitmcp-backup.tar.gz"
```

## Health Check

The container includes a health check that verifies the application is running:

```bash
# Check container health
docker-compose ps

# Manual health check
docker exec gitmcp-app wget --spider http://localhost:5173/
```

## Troubleshooting

### Container won't start

1. Check logs:
```bash
docker-compose logs gitmcp
```

2. Verify port availability:
```bash
lsof -i :5173
```

3. Rebuild the image:
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Out of memory

Increase Docker memory allocation in Docker Desktop settings or add to `docker-compose.yml`:

```yaml
services:
  gitmcp:
    mem_limit: 2g
    mem_reservation: 1g
```

### Permission issues

Ensure the container has proper permissions:

```bash
docker-compose exec gitmcp sh
ls -la /app
```

## Development Mode

To run in development mode with hot reload:

```bash
# Use development compose file
docker-compose -f docker-compose.dev.yml up
```

Create `docker-compose.dev.yml`:

```yaml
version: '3.8'

services:
  gitmcp:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    command: pnpm run dev --host 0.0.0.0
```

## Production Deployment

### Using Docker Swarm

```bash
docker stack deploy -c docker-compose.yml gitmcp
```

### Using Kubernetes

Convert the compose file to Kubernetes manifests:

```bash
kompose convert -f docker-compose.yml
kubectl apply -f .
```

## Updating

To update to the latest version:

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Cleanup

Remove all GitMCP containers and volumes:

```bash
docker-compose down -v
docker rmi gitmcp:latest
```

## Support

For issues related to Docker setup, please open an issue on GitHub with:
- Docker version (`docker --version`)
- Docker Compose version (`docker-compose --version`)
- Container logs (`docker-compose logs gitmcp`)
- Operating system and architecture

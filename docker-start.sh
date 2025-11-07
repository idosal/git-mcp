#!/bin/bash

# GitMCP Docker Quick Start Script
# This script helps you quickly set up and run GitMCP using Docker

set -e

echo "======================================"
echo "  GitMCP Docker Quick Start"
echo "======================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed"
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed and determine which version to use
DOCKER_COMPOSE_CMD=""
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
else
    echo "❌ Error: Docker Compose is not installed"
    echo "Please install Docker Compose from https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker is installed"
echo "✅ Docker Compose is installed"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env file and add your API keys"
    echo ""
fi

# Menu
echo "What would you like to do?"
echo "1) Build and start GitMCP"
echo "2) Stop GitMCP"
echo "3) View logs"
echo "4) Rebuild from scratch"
echo "5) Remove everything (including volumes)"
echo "6) Exit"
echo ""
read -p "Enter your choice (1-6): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Building and starting GitMCP..."
        $DOCKER_COMPOSE_CMD up -d --build
        echo ""
        echo "✅ GitMCP is now running!"
        echo "🌐 Access it at: http://localhost:5173"
        echo ""
        echo "📊 To view logs, run: $DOCKER_COMPOSE_CMD logs -f"
        ;;
    2)
        echo ""
        echo "🛑 Stopping GitMCP..."
        $DOCKER_COMPOSE_CMD down
        echo "✅ GitMCP stopped"
        ;;
    3)
        echo ""
        echo "📊 Showing logs (Ctrl+C to exit)..."
        $DOCKER_COMPOSE_CMD logs -f
        ;;
    4)
        echo ""
        echo "🔨 Rebuilding from scratch..."
        $DOCKER_COMPOSE_CMD down
        $DOCKER_COMPOSE_CMD build --no-cache
        $DOCKER_COMPOSE_CMD up -d
        echo ""
        echo "✅ GitMCP rebuilt and started!"
        echo "🌐 Access it at: http://localhost:5173"
        ;;
    5)
        echo ""
        read -p "⚠️  This will remove all data. Are you sure? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            echo "🗑️  Removing everything..."
            $DOCKER_COMPOSE_CMD down -v --rmi local
            echo "✅ Everything removed"
        else
            echo "❌ Cancelled"
        fi
        ;;
    6)
        echo ""
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo ""
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""

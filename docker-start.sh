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

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
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
        docker-compose up -d --build
        echo ""
        echo "✅ GitMCP is now running!"
        echo "🌐 Access it at: http://localhost:5173"
        echo ""
        echo "📊 To view logs, run: docker-compose logs -f"
        ;;
    2)
        echo ""
        echo "🛑 Stopping GitMCP..."
        docker-compose down
        echo "✅ GitMCP stopped"
        ;;
    3)
        echo ""
        echo "📊 Showing logs (Ctrl+C to exit)..."
        docker-compose logs -f
        ;;
    4)
        echo ""
        echo "🔨 Rebuilding from scratch..."
        docker-compose down
        docker-compose build --no-cache
        docker-compose up -d
        echo ""
        echo "✅ GitMCP rebuilt and started!"
        echo "🌐 Access it at: http://localhost:5173"
        ;;
    5)
        echo ""
        read -p "⚠️  This will remove all data. Are you sure? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            echo "🗑️  Removing everything..."
            docker-compose down -v
            docker rmi gitmcp-gitmcp 2>/dev/null || true
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

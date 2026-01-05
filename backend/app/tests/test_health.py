"""
Tests for health check endpoint
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    """Test that health endpoint returns 200 and correct data"""
    response = await client.get("/health")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "healthy"
    assert "app_name" in data
    assert "environment" in data
    assert "version" in data


@pytest.mark.asyncio
async def test_health_endpoint_has_request_id(client: AsyncClient):
    """Test that health endpoint includes X-Request-ID header"""
    response = await client.get("/health")
    
    assert "X-Request-ID" in response.headers
    assert response.headers["X-Request-ID"]  # Not empty


@pytest.mark.asyncio
async def test_root_endpoint(client: AsyncClient):
    """Test that root endpoint returns welcome message"""
    response = await client.get("/")
    
    assert response.status_code == 200
    data = response.json()
    
    assert "message" in data
    assert "docs" in data
    assert "health" in data


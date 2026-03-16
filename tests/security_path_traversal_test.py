import os
import pytest
from pathlib import Path
from fastapi import HTTPException
from api.strategy_builder_api import load_strategy as api_load, delete_strategy as api_delete
from api.routers.strategy_builder import get_strategy_info as router_info, delete_strategy as router_delete

STRATEGY_DIR = "artifacts/strategies"

@pytest.mark.asyncio
async def test_api_load_traversal():
    filename = "../../sensitive_file.txt"
    try:
        await api_load(filename)
    except HTTPException as e:
        assert e.status_code == 403
        assert e.detail == "Access denied"

@pytest.mark.asyncio
async def test_api_delete_traversal():
    filename = "../../sensitive_file.txt"
    try:
        await api_delete(filename)
    except HTTPException as e:
        assert e.status_code == 403
        assert e.detail == "Access denied"

@pytest.mark.asyncio
async def test_router_info_traversal():
    filename = "../../sensitive_file.txt"
    try:
        await router_info(filename)
    except HTTPException as e:
        assert e.status_code == 403
        assert e.detail == "Erişim engellendi"

@pytest.mark.asyncio
async def test_router_delete_traversal():
    filename = "../../sensitive_file.txt"
    try:
        await router_delete(filename)
    except HTTPException as e:
        assert e.status_code == 403
        assert e.detail == "Erişim engellendi"

@pytest.mark.asyncio
async def test_api_load_valid():
    # Setup: Create a valid strategy file
    os.makedirs(STRATEGY_DIR, exist_ok=True)
    filename = "test_strat.json"
    filepath = os.path.join(STRATEGY_DIR, filename)
    with open(filepath, "w") as f:
        f.write('{"name": "test"}')

    try:
        response = await api_load(filename)
        assert response["status"] == "success"
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)

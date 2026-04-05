def test_admin_can_create_and_update_user(client, admin_headers):
    create_response = client.post(
        "/api/v1/users",
        headers=admin_headers,
        json={
            "name": "Finance Analyst",
            "email": "finance.analyst@example.com",
            "password": "Analyst123!",
            "role": "analyst",
            "status": "active",
        },
    )

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["role"] == "analyst"

    update_response = client.patch(
        f"/api/v1/users/{created['id']}",
        headers=admin_headers,
        json={"role": "viewer", "status": "inactive"},
    )

    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["role"] == "viewer"
    assert updated["status"] == "inactive"


def test_admin_can_deactivate_user(client, admin_headers):
    create_response = client.post(
        "/api/v1/users",
        headers=admin_headers,
        json={
            "name": "Viewer Account",
            "email": "viewer.account@example.com",
            "password": "Viewer123!",
            "role": "viewer",
            "status": "active",
        },
    )
    user_id = create_response.json()["id"]

    response = client.post(f"/api/v1/users/{user_id}/deactivate", headers=admin_headers)

    assert response.status_code == 200
    assert response.json()["status"] == "inactive"


def test_analyst_cannot_manage_users(client, analyst_headers):
    response = client.post(
        "/api/v1/users",
        headers=analyst_headers,
        json={
            "name": "Blocked User",
            "email": "blocked.user@example.com",
            "password": "Blocked123!",
            "role": "viewer",
            "status": "active",
        },
    )

    assert response.status_code == 403

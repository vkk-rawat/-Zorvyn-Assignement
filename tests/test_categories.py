def test_admin_can_manage_categories_and_viewer_can_list_them(client, admin_headers, viewer_headers):
    create_response = client.post(
        "/api/v1/categories",
        headers=admin_headers,
        json={
            "name": "Subscriptions",
            "record_type": "expense",
            "description": "Recurring software costs",
            "is_active": True,
        },
    )

    assert create_response.status_code == 201
    category = create_response.json()
    assert category["record_type"] == "expense"

    update_response = client.patch(
        f"/api/v1/categories/{category['id']}",
        headers=admin_headers,
        json={"description": "Recurring SaaS costs"},
    )
    assert update_response.status_code == 200

    list_response = client.get("/api/v1/categories", headers=viewer_headers)
    assert list_response.status_code == 200
    assert list_response.json()["pagination"]["total_items"] == 1

    deactivate_response = client.post(
        f"/api/v1/categories/{category['id']}/deactivate",
        headers=admin_headers,
    )
    assert deactivate_response.status_code == 200
    assert deactivate_response.json()["is_active"] is False

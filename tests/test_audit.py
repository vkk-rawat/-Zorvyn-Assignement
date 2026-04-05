def test_admin_can_read_audit_logs_for_category_and_record_actions(client, admin_headers):
    category_response = client.post(
        "/api/v1/categories",
        headers=admin_headers,
        json={
            "name": "Investments",
            "record_type": "income",
            "description": "Returns and gains",
            "is_active": True,
        },
    )
    assert category_response.status_code == 201
    category = category_response.json()

    record_response = client.post(
        "/api/v1/records",
        headers=admin_headers,
        json={
            "amount": "450.00",
            "type": "income",
            "category_id": category["id"],
            "date": "2026-03-20",
            "notes": "Dividend payout",
        },
    )
    assert record_response.status_code == 201

    audit_response = client.get(
        "/api/v1/audit-logs?action=record.create",
        headers=admin_headers,
    )
    assert audit_response.status_code == 200
    body = audit_response.json()
    assert body["pagination"]["total_items"] >= 1
    assert any(item["action"] == "record.create" for item in body["items"])

def _seed_dashboard_records(client, admin_headers):
    salary_category = client.post(
        "/api/v1/categories",
        headers=admin_headers,
        json={
            "name": "Salary",
            "record_type": "income",
            "description": "Primary earnings",
            "is_active": True,
        },
    ).json()
    rent_category = client.post(
        "/api/v1/categories",
        headers=admin_headers,
        json={
            "name": "Rent",
            "record_type": "expense",
            "description": "Property costs",
            "is_active": True,
        },
    ).json()
    consulting_category = client.post(
        "/api/v1/categories",
        headers=admin_headers,
        json={
            "name": "Consulting",
            "record_type": "income",
            "description": "Project earnings",
            "is_active": True,
        },
    ).json()
    utilities_category = client.post(
        "/api/v1/categories",
        headers=admin_headers,
        json={
            "name": "Utilities",
            "record_type": "expense",
            "description": "Utility bills",
            "is_active": True,
        },
    ).json()

    records = [
        {
            "amount": "5000.00",
            "type": "income",
            "category_id": salary_category["id"],
            "date": "2026-01-05",
            "notes": "Primary income",
        },
        {
            "amount": "1200.00",
            "type": "expense",
            "category_id": rent_category["id"],
            "date": "2026-01-07",
            "notes": "Office rent",
        },
        {
            "amount": "2000.00",
            "type": "income",
            "category_id": consulting_category["id"],
            "date": "2026-02-12",
            "notes": "Project income",
        },
        {
            "amount": "300.00",
            "type": "expense",
            "category_id": utilities_category["id"],
            "date": "2026-02-20",
            "notes": "Internet and power",
        },
    ]

    for payload in records:
        client.post("/api/v1/records", headers=admin_headers, json=payload)


def test_viewer_can_access_dashboard_but_not_records(client, admin_headers, viewer_headers):
    _seed_dashboard_records(client, admin_headers)

    summary_response = client.get("/api/v1/dashboard/summary", headers=viewer_headers)
    assert summary_response.status_code == 200
    assert summary_response.json()["net_balance"] == "5500.00"

    records_response = client.get("/api/v1/records", headers=viewer_headers)
    assert records_response.status_code == 403


def test_dashboard_aggregations_return_expected_totals(client, admin_headers, analyst_headers):
    _seed_dashboard_records(client, admin_headers)

    summary_response = client.get("/api/v1/dashboard/summary", headers=analyst_headers)
    assert summary_response.status_code == 200
    summary = summary_response.json()
    assert summary["total_income"] == "7000.00"
    assert summary["total_expenses"] == "1500.00"
    assert summary["net_balance"] == "5500.00"

    category_response = client.get("/api/v1/dashboard/category-totals", headers=analyst_headers)
    assert category_response.status_code == 200
    assert len(category_response.json()["items"]) == 4

    trends_response = client.get("/api/v1/dashboard/monthly-trends", headers=analyst_headers)
    assert trends_response.status_code == 200
    trends = trends_response.json()["items"]
    assert [item["month"] for item in trends] == ["2026-01", "2026-02"]

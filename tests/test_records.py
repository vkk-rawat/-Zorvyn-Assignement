def _create_category(client, headers, *, name: str, record_type: str, description: str = ""):
    response = client.post(
        "/api/v1/categories",
        headers=headers,
        json={
            "name": name,
            "record_type": record_type,
            "description": description,
            "is_active": True,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_admin_can_crud_records(client, admin_headers):
    salary_category = _create_category(
        client,
        admin_headers,
        name="Salary",
        record_type="income",
        description="Payroll income",
    )

    create_response = client.post(
        "/api/v1/records",
        headers=admin_headers,
        json={
            "amount": "2500.00",
            "type": "income",
            "category_id": salary_category["id"],
            "date": "2026-03-01",
            "notes": "Monthly payroll",
        },
    )

    assert create_response.status_code == 201
    record = create_response.json()

    update_response = client.patch(
        f"/api/v1/records/{record['id']}",
        headers=admin_headers,
        json={"notes": "Updated payroll note"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["notes"] == "Updated payroll note"

    delete_response = client.delete(f"/api/v1/records/{record['id']}", headers=admin_headers)
    assert delete_response.status_code == 204

    list_response = client.get("/api/v1/records", headers=admin_headers)
    assert list_response.status_code == 200
    assert list_response.json()["items"] == []


def test_analyst_can_read_records_but_cannot_create(client, admin_headers, analyst_headers):
    income_category = _create_category(
        client,
        admin_headers,
        name="Consulting",
        record_type="income",
        description="Client projects",
    )
    expense_category = _create_category(
        client,
        admin_headers,
        name="Travel",
        record_type="expense",
        description="Travel costs",
    )

    client.post(
        "/api/v1/records",
        headers=admin_headers,
        json={
            "amount": "1000.00",
            "type": "income",
            "category_id": income_category["id"],
            "date": "2026-03-10",
            "notes": "Client invoice",
        },
    )

    read_response = client.get("/api/v1/records", headers=analyst_headers)
    assert read_response.status_code == 200
    assert len(read_response.json()["items"]) == 1

    create_response = client.post(
        "/api/v1/records",
        headers=analyst_headers,
        json={
            "amount": "200.00",
            "type": "expense",
            "category_id": expense_category["id"],
            "date": "2026-03-11",
            "notes": "Taxi",
        },
    )
    assert create_response.status_code == 403


def test_record_filters_and_pagination(client, admin_headers):
    salary_category = _create_category(
        client,
        admin_headers,
        name="Salary",
        record_type="income",
        description="Payroll",
    )
    food_category = _create_category(
        client,
        admin_headers,
        name="Food",
        record_type="expense",
        description="Meals",
    )

    records = [
        {
            "amount": "3000.00",
            "type": "income",
            "category_id": salary_category["id"],
            "date": "2026-01-01",
            "notes": "January salary",
        },
        {
            "amount": "150.00",
            "type": "expense",
            "category_id": food_category["id"],
            "date": "2026-01-02",
            "notes": "Team lunch",
        },
        {
            "amount": "3200.00",
            "type": "income",
            "category_id": salary_category["id"],
            "date": "2026-02-01",
            "notes": "February salary",
        },
    ]

    for payload in records:
        client.post("/api/v1/records", headers=admin_headers, json=payload)

    response = client.get(
        "/api/v1/records?page=1&page_size=1&category=Salary&type=income",
        headers=admin_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["pagination"]["total_items"] == 2
    assert body["pagination"]["total_pages"] == 2
    assert len(body["items"]) == 1


def test_record_rejects_category_type_mismatch(client, admin_headers):
    expense_category = _create_category(
        client,
        admin_headers,
        name="Operations",
        record_type="expense",
        description="Operational spending",
    )

    response = client.post(
        "/api/v1/records",
        headers=admin_headers,
        json={
            "amount": "800.00",
            "type": "income",
            "category_id": expense_category["id"],
            "date": "2026-03-15",
            "notes": "Bad category selection",
        },
    )

    assert response.status_code == 400

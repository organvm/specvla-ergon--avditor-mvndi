# API Reference

Welcome to the Specula Ergon Auditor Mundi API. This API allows paying customers with an active **Pro** or standard subscription to programmatically generate Cosmic Strategy Audits for websites and social media profiles.

## Authentication

All API requests require authentication using a Personal Access Token (PAT). You can generate and manage your PATs from the settings area in your dashboard.

To authenticate your request, include your PAT in the `Authorization` header as a Bearer token:

```http
Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN
```

### Authorization Requirements

- Your token must be valid.
- You must have an active subscription.
- Requests with missing or invalid tokens will return a `401 Unauthorized` status.
- Requests made without an active subscription will return a `403 Forbidden` status.

---

## Endpoints

### Generate Cosmic Audit

**Endpoint:** `POST /api/v1/analyze`

Generates a structured growth audit based on high-performance marketing data and intuitive business alignment. Pro subscribers benefit from deeper website scraping (up to 3 pages vs. 1 page for standard users).

#### Request Headers

| Header | Value | Required |
| :--- | :--- | :--- |
| `Content-Type` | `application/json` | Yes |
| `Authorization` | `Bearer YOUR_PERSONAL_ACCESS_TOKEN` | Yes |

#### Request Body

The request body must be a JSON object containing the following required fields:

| Field | Type | Description |
| :--- | :--- | :--- |
| `link` | `string` | The URL of the website or social media profile you wish to audit. |
| `businessType` | `string` | A description of the type of business (e.g., "e-commerce", "SaaS", "local coaching"). |
| `goals` | `string` | The primary goals of the business or the website (e.g., "Increase conversion rate", "Drive more organic traffic"). |

**Example Request:**

```bash
curl -X POST https://api.avditor-mvndi.com/api/v1/analyze \
  -H "Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "link": "https://example.com",
    "businessType": "B2B SaaS Startup",
    "goals": "Increase trial signups and improve user onboarding flow"
  }'
```

#### Response

A successful request returns a `200 OK` status and a JSON object containing the generated markdown audit and numerical evaluation scores.

| Field | Type | Description |
| :--- | :--- | :--- |
| `markdownAudit` | `string` | The full text of the audit, formatted in Markdown. Includes overview, strengths, bottlenecks, insights, immediate improvements, and strategic opportunities. |
| `scores` | `object` | An object containing numerical scores (0-100) across four planetary archetypes representing different business facets. |
| `scores.communication` | `number` | The Mercury score. Represents the effectiveness of messaging and copy. |
| `scores.aesthetic` | `number` | The Venus score. Represents visual alignment and design friction. |
| `scores.drive` | `number` | The Mars score. Represents momentum, conversion focus, and calls to action. |
| `scores.structure` | `number` | The Saturn score. Represents technical setup, SEO, performance, and architecture. |

**Example Response:**

```json
{
  "markdownAudit": "# Overview: The Current Energy\n\nYour site projects strong, clear authority but lacks...",
  "scores": {
    "communication": 82,
    "aesthetic": 75,
    "drive": 68,
    "structure": 90
  }
}
```

#### Error Responses

| Status Code | Description |
| :--- | :--- |
| `400 Bad Request` | Returned when required fields (`link`, `businessType`, `goals`) are missing from the request body. |
| `401 Unauthorized` | Returned when the Authorization header is missing, incorrectly formatted, or the PAT is invalid. |
| `403 Forbidden` | Returned when the user tied to the PAT does not have an active subscription. |
| `500 Internal Server Error` | Returned if the AI generation fails or another server-side issue occurs. |

---

## Best Practices

1. **Provide Specific Goals**: The more specific you are with the `goals` and `businessType` fields, the more tailored and actionable the resulting audit will be.
2. **Handle Timeouts Appropriately**: Generating an audit requires scraping the provided URL, fetching performance metrics (like Google PageSpeed Insights), and processing via AI. This can take several seconds. Ensure your HTTP client's timeout limits are configured properly (we recommend at least 30-60 seconds).
3. **Parse Markdown Safely**: The `markdownAudit` response field contains markdown. If you plan to render this in a web interface, use a reliable and secure markdown parser that sanitizes output to prevent XSS.

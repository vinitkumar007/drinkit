# API reference

JSON over HTTP. Authenticated routes need `Authorization: Bearer <token>` (from `verify-otp`). Errors look like `{ "error": "message" }`.

## Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/request-otp` | `{phone}`. Dev mode returns `dev_otp`. Rate limited. |
| POST | `/api/auth/verify-otp` | `{phone, otp, name?}` → `{token, user}`. 5 wrong tries lock the OTP. |
| GET / PATCH | `/api/me` | Profile; PATCH `{name}`. |
| POST | `/api/auth/age` | `{dob:"YYYY-MM-DD", state}`. 403 if under that state's minimum age. |

## Catalog (public)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{ok:true}` |
| GET | `/api/serviceability?lat&lng` | `{serviceable, reason?, store?, eta_minutes?}` |
| GET | `/api/categories` | |
| GET | `/api/products?store_id&category?&q?` | Active products with that store's stock. |
| POST | `/api/coupons/validate` | auth. `{code, subtotal}` → `{code, discount}` |

## Customer
| Method | Path | Notes |
|---|---|---|
| GET / POST | `/api/addresses` | POST `{label, address, lat, lng}`; max 10. |
| DELETE | `/api/addresses/:id` | |
| POST | `/api/orders` | `{items:[{product_id, qty}], address_id \| {address, lat, lng}, payment_method?, coupon_code?}` → 201 order |
| GET | `/api/orders`, `/api/orders/:id` | Only the owner sees `delivery_otp`. |
| POST | `/api/orders/:id/cancel` | Allowed while `placed` or `accepted`. |

## Admin (role `admin`)
`GET /api/admin/stats`, `stores`, `riders`, `audit`, `orders?status=`, `inventory?store_id=`, `products`, `coupons`
`PATCH /api/admin/orders/:id/status` `{status}` · `POST /api/admin/orders/:id/assign` `{rider_id}`
`PATCH /api/admin/inventory` `{store_id, product_id, stock}`
`POST /api/admin/products`, `PATCH /api/admin/products/:id` · `POST /api/admin/coupons`, `PATCH /api/admin/coupons/:code`

## Rider (role `rider`)
`GET /api/rider/me`, `PATCH /api/rider/availability` `{available}`, `GET /api/rider/orders`
`POST /api/rider/orders/:id/pickup`
`POST /api/rider/orders/:id/deliver` `{otp, id_checked:true}`
`POST /api/rider/orders/:id/refuse` `{reason?}`

## Status codes
400 bad input · 401 not logged in · 403 not allowed (role, age) · 404 not found · 409 conflict (stock, wrong status) · 429 too many attempts.

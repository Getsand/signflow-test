from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple


def _normalize_signing_order(value: Optional[str]) -> str:
    if not value:
        return "SEQUENTIAL"
    v = str(value).strip().upper()
    if v in {"SEQUENTIAL", "SEQUENTIAL(S)", "SEQ"}:
        return "SEQUENTIAL"
    if v in {"PARALLEL", "PARALLEL(P)", "PAR"}:
        return "PARALLEL"
    # Default to sequential to match SignFlo defaults.
    return "SEQUENTIAL"


def _parse_int(value: Any, default: int = 0) -> int:
    try:
        i = int(value)
        return i
    except Exception:
        return default


def _extract_recipients(zoho_payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Best-effort extraction of recipients for SignFlo.

    Expected internal shape:
      [{ "role": str, "email": str, "order_index": int }]
    """

    candidates: List[Any] = []
    for key in ("recipients", "request_recipients", "signers", "actions"):
        if key in zoho_payload:
            candidates.append(zoho_payload.get(key))

    # Some Zoho-style payloads wrap everything in a "requests" object.
    if not candidates and "requests" in zoho_payload and isinstance(zoho_payload["requests"], dict):
        for key in ("recipients", "signers", "request_recipients", "actions"):
            if key in zoho_payload["requests"]:
                candidates.append(zoho_payload["requests"].get(key))

    recipients_raw: Any = None
    for c in candidates:
        if c is None:
            continue
        if isinstance(c, list):
            recipients_raw = c
            break
        if isinstance(c, dict):
            # Sometimes Zoho returns {"recipient": [...]} or similar.
            for v in c.values():
                if isinstance(v, list):
                    recipients_raw = v
                    break
        if recipients_raw is not None:
            break

    if recipients_raw is None:
        raise ValueError("Missing recipients/signers in requests payload")

    if not isinstance(recipients_raw, list):
        raise ValueError("Invalid recipients format; expected array")

    recipients: List[Dict[str, Any]] = []
    for idx, r in enumerate(recipients_raw):
        if not isinstance(r, dict):
            continue

        # Zoho uses "email" and sometimes "roleName"/"name"/"recipientName".
        email = (
            r.get("email")
            or r.get("recipient_email")
            or r.get("signer_email")
            or r.get("identifier")
        )
        if not email:
            continue

        role = (
            r.get("role")
            or r.get("role_name")
            or r.get("roleName")
            or r.get("recipient_role")
            or r.get("recipientName")
            or r.get("recipient_name")
            or r.get("name")
        )
        if not role:
            # Fallback: preserve stable ordering.
            role = r.get("order_index") or f"Signer {idx + 1}"

        order_index = (
            r.get("order_index")
            or r.get("orderIndex")
            or r.get("sequence")
            or r.get("index")
            or r.get("order")
        )
        order = _parse_int(order_index, default=idx)
        if order < 0:
            order = idx

        recipients.append({"role": str(role), "email": str(email), "order_index": order})

    if not recipients:
        raise ValueError("No valid recipients found in requests payload")

    return recipients


def convert_create_request_payload(requests_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert Zoho "requests" payload into SignFlo create-signing-request payload.

    Output matches backend signing-requests create JSON:
      {
        "title": Optional[str],
        "signing_order": "SEQUENTIAL" | "PARALLEL",
        "recipients": [{ "role": str, "email": str, "order_index": int }]
      }
    """
    if not isinstance(requests_payload, dict):
        raise ValueError("requests payload must be a JSON object")

    inner = requests_payload.get("requests")
    inner_d: Dict[str, Any] = inner if isinstance(inner, dict) else {}

    # Title guesses.
    title = (
        requests_payload.get("title")
        or requests_payload.get("request_name")
        or inner_d.get("request_name")
        or inner_d.get("title")
        or requests_payload.get("name")
        or requests_payload.get("document_title")
        or requests_payload.get("subject")
    )
    if isinstance(title, dict):
        title = title.get("value")
    if title is not None:
        title = str(title)

    signing_order = _normalize_signing_order(
        inner_d.get("signing_order")
        or inner_d.get("signingOrder")
        or requests_payload.get("signing_order")
        or requests_payload.get("signingOrder")
        or requests_payload.get("order_type")
        or requests_payload.get("signingOrderType")
        or requests_payload.get("signing_order_type")
    )

    recipients = _extract_recipients(requests_payload)
    return {
        "title": title,
        "signing_order": signing_order,
        "recipients": recipients,
    }


def _to_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def _extract_actions(requests_payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    # Zoho shapes vary; try a few common keys.
    if not isinstance(requests_payload, dict):
        return []

    # Official Zoho shape: { "requests": { "actions": [ ... ] } }
    nested = requests_payload.get("requests")
    if isinstance(nested, dict) and isinstance(nested.get("actions"), list):
        return [a for a in nested["actions"] if isinstance(a, dict)]

    if isinstance(requests_payload.get("actions"), list):
        return [a for a in requests_payload["actions"] if isinstance(a, dict)]

    # Some payloads use "request_actions"
    if isinstance(requests_payload.get("request_actions"), list):
        return [a for a in requests_payload["request_actions"] if isinstance(a, dict)]

    return []


def _action_signer_email(action: Dict[str, Any]) -> Optional[str]:
    return (
        action.get("recipient_email")
        or action.get("signerEmail")
        or action.get("signer_email")
        or action.get("email")
    )


def _nested_field_lists(action: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Zoho nests coordinates under each action's `fields` (or document_fields)."""
    out: List[Dict[str, Any]] = []
    for key in ("fields", "document_fields", "signer_fields"):
        raw = action.get(key)
        if isinstance(raw, list):
            for item in raw:
                if isinstance(item, dict):
                    out.append(item)
                    # Radio groups: coordinates on sub_fields
                    subs = item.get("sub_fields")
                    if isinstance(subs, list):
                        for sub in subs:
                            if isinstance(sub, dict):
                                out.append(sub)
    return out


def _extract_geometry(d: Dict[str, Any]) -> Optional[Tuple[int, float, float, float, float]]:
    """
    Return (page_1based, x, y, width, height) for SignFlo template fields.

    Supports:
    - Zoho nested fields: x_value, y_value, width, height, page_no (page_no is 0-based per Zoho docs)
    - Flat / wrapper examples: pageNumber, left, top, width, height (page 1-based)
    """
    loc = d.get("location") or d.get("coordinates") or d.get("bounds") or {}
    if not isinstance(loc, dict):
        loc = {}

    # --- Zoho API style (signer-fields docs) ---
    if any(k in d for k in ("x_value", "y_value", "x_coord", "y_coord")):
        page_raw = d.get("page_no")
        if page_raw is None:
            return None
        p_f = _to_float(page_raw)
        if p_f is None:
            return None
        page_int = int(p_f) + 1  # Zoho: first page is 0
        x_f = _to_float(d.get("x_value") or d.get("x_coord"))
        y_f = _to_float(d.get("y_value") or d.get("y_coord"))
        w_f = _to_float(d.get("width") or d.get("abs_width"))
        h_f = _to_float(d.get("height") or d.get("abs_height"))
        if page_int < 1 or x_f is None or y_f is None or w_f is None or h_f is None:
            return None
        if w_f <= 0 or h_f <= 0:
            return None
        return (page_int, x_f, y_f, w_f, h_f)

    # --- Flat / simple JSON (1-based page) ---
    page = d.get("pageNumber") or d.get("page") or d.get("page_number") or loc.get("page")
    page_f = _to_float(page)
    page_int: Optional[int] = None
    if page_f is not None:
        page_int = int(page_f)

    x = loc.get("x") or d.get("x") or loc.get("left") or d.get("left") or d.get("x1") or loc.get("posX")
    y = loc.get("y") or d.get("y") or loc.get("top") or d.get("top") or d.get("y1") or loc.get("posY")
    width = loc.get("width") or d.get("width") or d.get("w") or loc.get("w")
    height = loc.get("height") or d.get("height") or d.get("h") or loc.get("h")

    x_f = _to_float(x)
    y_f = _to_float(y)
    w_f = _to_float(width)
    h_f = _to_float(height)

    if page_int is None or x_f is None or y_f is None or w_f is None or h_f is None:
        return None
    if page_int < 1 or w_f <= 0 or h_f <= 0:
        return None
    return (page_int, x_f, y_f, w_f, h_f)


def _field_type_from_zoho(field: Dict[str, Any], fallback: str = "SIGNATURE") -> str:
    name = field.get("field_type_name") or field.get("field_type") or field.get("type")
    if isinstance(name, str):
        u = name.strip().upper()
        if "INITIAL" in u:
            return "INITIAL"
        if "TEXT" in u or "TEXTFIELD" in u:
            return "TEXT"
        if "SIGN" in u or "SIGNATURE" in u:
            return "SIGNATURE"
    return fallback


def _resolve_role_for_email(
    email: Optional[str],
    recipients: List[Dict[str, Any]],
) -> Optional[str]:
    if not email:
        return None
    email_l = str(email).strip().lower()
    for r in recipients:
        if str(r.get("email") or "").strip().lower() == email_l:
            return r.get("role")
    return None


def convert_actions_to_signature_fields(
    requests_payload: Dict[str, Any],
    recipients: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Best-effort conversion of Zoho "actions" (signature boxes) into SignFlo template signature fields.

    This enables `send` to work, because SignFlo refuses to send without template signature fields.

    Supports:
    - Official Zoho: each action has `fields`[] with x_value, y_value, width, height, page_no (0-based).
    - Flat JSON on the action: pageNumber (1-based), left/top, width, height.
    """
    actions = _extract_actions(requests_payload)
    if not actions:
        return []

    fields: List[Dict[str, Any]] = []
    for idx, a in enumerate(actions):
        parent_email = _action_signer_email(a)

        # --- A) Geometry directly on the action (simple / wrapper examples) ---
        geom_action = _extract_geometry(a)
        if geom_action:
            page_int, x_f, y_f, w_f, h_f = geom_action
            email = (
                a.get("signerEmail")
                or a.get("signer_email")
                or a.get("email")
                or a.get("recipient_email")
                or a.get("identifier")
                or parent_email
            )
            role = (
                _resolve_role_for_email(email=email, recipients=recipients)
                or a.get("role")
                or a.get("recipient_role")
            )
            if not role and len(recipients) == 1:
                role = recipients[0].get("role")

            action_type = a.get("type") or a.get("action_type") or a.get("field_type")
            field_type = "SIGNATURE"
            if isinstance(action_type, str):
                t = action_type.strip().upper()
                if "INITIAL" in t:
                    field_type = "INITIAL"
                elif "TEXT" in t:
                    field_type = "TEXT"
                elif "SIGN" in t or "SIGNATURE" in t:
                    field_type = "SIGNATURE"

            if role:
                fields.append(
                    {
                        "page": page_int,
                        "x": x_f,
                        "y": y_f,
                        "width": w_f,
                        "height": h_f,
                        "field_type": field_type,
                        "role": role,
                        "zoho_action_index": idx,
                    }
                )

        # --- B) Zoho nested fields under each action ---
        nested = _nested_field_lists(a)
        for fidx, fld in enumerate(nested):
            geom = _extract_geometry(fld)
            if not geom:
                continue
            page_int, x_f, y_f, w_f, h_f = geom

            email = (
                fld.get("signerEmail")
                or fld.get("email")
                or fld.get("recipient_email")
                or parent_email
            )
            role = _resolve_role_for_email(email=email, recipients=recipients)
            if not role and len(recipients) == 1:
                role = recipients[0].get("role")
            if not role:
                # Cannot assign template field to a recipient
                continue

            field_type = _field_type_from_zoho(fld, fallback="SIGNATURE")
            fields.append(
                {
                    "page": page_int,
                    "x": x_f,
                    "y": y_f,
                    "width": w_f,
                    "height": h_f,
                    "field_type": field_type,
                    "role": role,
                    "zoho_action_index": idx,
                    "zoho_field_index": fidx,
                }
            )

    return fields


def map_status(internal_status: str, *, total_signature_fields: Optional[int] = None, signed_fields_count: Optional[int] = None) -> str:
    """
    Map internal signing request lifecycle to Zoho Sign request_status.

    Required mapping:
      draft -> created
      sent -> sent
      opened -> viewed
      signed -> signed
      done -> completed
      rejected -> declined
    """
    s = (internal_status or "").strip().upper()
    if s == "DRAFT":
        return "created"
    if s == "SENT":
        # If backend still reports SENT but signatures exist, approximate.
        if signed_fields_count is not None and signed_fields_count > 0:
            return "signed"
        return "sent"
    if s in {"IN_PROGRESS", "OPENED"}:
        if signed_fields_count is not None and signed_fields_count > 0:
            return "signed"
        return "viewed"
    if s in {"COMPLETED", "DONE"}:
        return "completed"
    if s in {"REJECTED", "DECLINED"}:
        return "declined"
    # Default safe fallback.
    return "created"


def map_actions(
    recipients: List[Dict[str, Any]],
    *,
    signing_tokens: Optional[Dict[str, str]] = None,
    frontend_base_url: str = "http://localhost:5173",
) -> List[Dict[str, Any]]:
    """
    Convert internal recipients to Zoho-compatible actions list.

    - action_id is set to recipient_id
    - sign_url is returned only when we have a token
    """
    actions: List[Dict[str, Any]] = []
    for r in recipients:
        recipient_id = r.get("id") or r.get("recipient_id")
        if recipient_id is None:
            continue

        token = signing_tokens.get(str(recipient_id)) if signing_tokens else None
        sign_url = f"{frontend_base_url.rstrip('/')}/sign/{token}" if token else None

        internal_recipient_status = str(r.get("status") or "").strip().upper()
        # Best-effort mapping (Zoho action statuses aren't specified in your requirements).
        action_status = "signed" if internal_recipient_status == "SIGNED" else "sent"

        actions.append(
            {
                "action_id": str(recipient_id),
                "action_status": action_status,
                "recipient_email": r.get("email"),
                "recipient_name": r.get("role") or r.get("recipient_name"),
                "order_index": r.get("order_index", 0),
                "sign_url": sign_url,
            }
        )
    return actions


def map_internal_to_zoho_response(
    *,
    code: int = 0,
    message: str = "Success",
    request_id: Optional[str] = None,
    internal_status: Optional[str] = None,
    actions: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    req_status = map_status(internal_status or "")
    payload: Dict[str, Any] = {"code": code, "message": message}
    if request_id is not None:
        payload["requests"] = {
            "request_id": request_id,
            "request_status": req_status,
        }
    if actions is not None and request_id is not None:
        payload["requests"]["actions"] = actions
    return payload


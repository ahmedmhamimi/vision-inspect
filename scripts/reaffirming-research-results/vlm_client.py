"""
Calls the real Gemini API (model set by config.GEMINI_MODEL) for a single defect
hypothesis per image, with structured JSON output and server-side schema
validation. Also supports the manuscript's *proposed* borderline repeat-
sampling extension (N calls at a set temperature) so that extension can
actually be exercised against real images rather than only described.

- build_prompt(defect_taxonomy) -> str: builds the inspection prompt listing the real candidate defect types for this category.
- call_gemini_once(image_path, api_key, defect_taxonomy, temperature=0.0) -> dict: one real API call, returns hypothesis + timing + token usage.
- call_gemini_repeated(image_path, api_key, defect_taxonomy, n, temperature) -> list[dict]: n real repeated calls for the borderline-sampling protocol.
"""

import base64
import json
import time
import mimetypes

import requests

from config import GEMINI_MODEL, GEMINI_API_URL_TEMPLATE, REQUEST_TIMEOUT_SECONDS, MAX_RETRIES


RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "defect_present": {"type": "BOOLEAN"},
        "defect_type": {"type": "STRING"},
        "confidence": {"type": "NUMBER"},
        "evidence": {"type": "STRING"},
        "location": {"type": "STRING"},
    },
    "required": ["defect_present", "defect_type", "confidence", "evidence", "location"],
}


def build_prompt(defect_taxonomy):
    taxonomy_str = ", ".join(defect_taxonomy + ["good (no defect)"])
    return (
        "You are inspecting a single product image for manufacturing defects. "
        f"The possible defect categories for this product are: {taxonomy_str}. "
        "Examine the image and report: whether a defect is present, which single "
        "defect_type applies (use 'good' if none), your confidence in that "
        "judgement as a float in [0,1], a short evidence string describing the "
        "specific visual cues that support your judgement, and a location string "
        "describing where on the object the defect (or lack thereof) is observed. "
        "Respond only with the requested structured fields."
    )


def _encode_image(image_path: str):
    mime_type, _ = mimetypes.guess_type(image_path)
    mime_type = mime_type or "image/png"
    with open(image_path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    return mime_type, data


def call_gemini_once(image_path: str, api_key: str, defect_taxonomy, temperature: float = 0.0) -> dict:
    mime_type, image_b64 = _encode_image(image_path)
    prompt = build_prompt(defect_taxonomy)

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": mime_type, "data": image_b64}},
            ]
        }],
        "generationConfig": {
            "temperature": temperature,
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
        },
    }

    url = GEMINI_API_URL_TEMPLATE.format(model=GEMINI_MODEL)
    headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}

    last_error = None
    for attempt in range(MAX_RETRIES):
        start = time.perf_counter()
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            resp.raise_for_status()
            body = resp.json()

            candidate_text = body["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(candidate_text)

            usage = body.get("usageMetadata", {})

            return {
                "defect_present": bool(parsed["defect_present"]),
                "defect_type": str(parsed["defect_type"]),
                "confidence": float(parsed["confidence"]),
                "evidence": str(parsed["evidence"]),
                "location": str(parsed["location"]),
                "latency_ms": elapsed_ms,
                "prompt_tokens": usage.get("promptTokenCount"),
                "output_tokens": usage.get("candidatesTokenCount"),
                "total_tokens": usage.get("totalTokenCount"),
                "raw_temperature": temperature,
                "api_call_succeeded": True,
            }
        except requests.exceptions.HTTPError as e:
            last_error = e
            status = e.response.status_code if e.response is not None else None
            # Non-transient client errors (bad auth, bad model name, bad request,
            # not-found endpoint) won't fix themselves on retry -- fail fast
            # instead of burning MAX_RETRIES on every sample. 429 (rate limit)
            # is the one 4xx worth retrying.
            if status is not None and 400 <= status < 500 and status != 429:
                break
            time.sleep(min(2 ** attempt, 8))
        except Exception as e:  # noqa: BLE001 -- retry on anything else transient (timeouts, connection errors, etc.)
            last_error = e
            time.sleep(min(2 ** attempt, 8))

    return {
        "defect_present": None,
        "defect_type": None,
        "confidence": None,
        "evidence": None,
        "location": None,
        "latency_ms": None,
        "prompt_tokens": None,
        "output_tokens": None,
        "total_tokens": None,
        "raw_temperature": temperature,
        "api_call_succeeded": False,
        "error": str(last_error),
    }


def call_gemini_repeated(image_path: str, api_key: str, defect_taxonomy, n: int, temperature: float):
    """Real repeated calls for the borderline self-consistency sampling protocol."""
    return [call_gemini_once(image_path, api_key, defect_taxonomy, temperature=temperature) for _ in range(n)]

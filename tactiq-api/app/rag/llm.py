"""Thin wrapper around the Gemini API (google-genai).

One call = one generation. There is no tool-calling and no loop: the pipeline decides everything
and the LLM only writes text (or JSON matching a fixed schema). The SDK's automatic function calling
is explicitly disabled.

Resilience (free tier): if the main model is overloaded (503/500) or rate-limited (429), the same
request is sent once to the fallback model. This is a fixed retry, not a decision by the model.

Run `python -m app.rag.llm` to list the models your API key can use.
"""

import logging
from functools import lru_cache

from pydantic import BaseModel

from app.config import settings

log = logging.getLogger(__name__)

RETRYABLE = {429, 500, 502, 503, 504}


class LLMUnavailable(RuntimeError):
    """Raised with a message that is safe to show to the user."""


@lru_cache
def _client():
    from google import genai

    if not settings.gemini_api_key:
        raise LLMUnavailable("The AI coach is not configured: GEMINI_API_KEY is missing in tactiq-api/.env.")
    return genai.Client(api_key=settings.gemini_api_key)


def _user_message(e, model: str) -> str:
    if e.code == 429:
        return "The free Gemini quota is busy right now (rate limit reached). Please wait a minute and try again."
    if e.code in (400, 401, 403):
        return f"Gemini rejected the request ({e.code}). Check GEMINI_API_KEY and GEMINI_MODEL in tactiq-api/.env."
    if e.code == 404:
        return f"Gemini model '{model}' was not found. Run `python -m app.rag.llm` to list models."
    return "The AI service is very busy right now. Please try again in a moment."


def generate(
    system: str,
    prompt: str,
    *,
    temperature: float = 0.3,
    schema: type[BaseModel] | None = None,
    max_output_tokens: int = 2048,
) -> str:
    from google.genai import errors, types

    config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )
    if schema is not None:
        config.response_mime_type = "application/json"
        config.response_schema = schema

    client = _client()  # raises a clear LLMUnavailable if the key is missing
    models = [settings.gemini_model]
    if settings.gemini_fallback_model and settings.gemini_fallback_model != settings.gemini_model:
        models.append(settings.gemini_fallback_model)

    for i, model in enumerate(models):
        try:
            response = client.models.generate_content(model=model, contents=prompt, config=config)
        except errors.APIError as e:
            if e.code in RETRYABLE and i + 1 < len(models):
                log.warning("Gemini %s returned %s; retrying with %s", model, e.code, models[i + 1])
                continue
            raise LLMUnavailable(_user_message(e, model)) from e
        except Exception as e:  # network errors etc.
            raise LLMUnavailable("Could not reach the AI service. Check your internet connection.") from e

        text = response.text
        if not text:
            raise LLMUnavailable("The AI returned an empty response. Please rephrase and try again.")
        return text.strip()

    raise LLMUnavailable("The AI service is very busy right now. Please try again in a moment.")


def list_models() -> list[str]:
    return [
        m.name.removeprefix("models/")
        for m in _client().models.list()
        if "generateContent" in (m.supported_actions or [])
    ]


if __name__ == "__main__":
    print(f"Configured model: {settings.gemini_model} (fallback: {settings.gemini_fallback_model})")
    print("Models available to your key:")
    for name in list_models():
        print("  " + name)

import base64
import os
from typing import Any

import httpx


class BhashiniService:
    """
    BHASHINI API service for WeatherGPT.

    Flow:
        1. Pipeline Config
           userID + Udyat Key
                ↓
           service IDs + callback URL + inference auth

        2. Pipeline Compute
           audio/text
                ↓
           ASR / Translation / TTS
    """

    PIPELINE_CONFIG_URL = os.getenv(
        "BHASHINI_PIPELINE_URL",
        "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline",
    )

    def __init__(self):
        self.api_key = os.getenv(
            "BHASHINI_API_KEY",
            "",
        ).strip()

        self.user_id = os.getenv(
            "BHASHINI_USER_ID",
            "",
        ).strip()

        self.inference_key = os.getenv(
            "BHASHINI_INFERENCE_KEY",
            "",
        ).strip()

        self.callback_url = os.getenv(
            "BHASHINI_CALLBACK_URL",
            "",
        ).strip()

        self._pipeline_cache: dict[tuple, dict[str, Any]] = {}

    # ---------------------------------------------------------
    # Validation
    # ---------------------------------------------------------

    def _validate_pipeline_credentials(self):
        if not self.api_key:
            raise RuntimeError(
                "BHASHINI_API_KEY is not configured."
            )

        if not self.user_id:
            raise RuntimeError(
                "BHASHINI_USER_ID is not configured. "
                "Get the User ID from your BHASHINI account/My Profile."
            )

    # ---------------------------------------------------------
    # Pipeline Config
    # ---------------------------------------------------------

    async def _get_pipeline_config(
        self,
        task_type: str,
        source_language: str,
        target_language: str | None = None,
    ) -> dict[str, Any]:

        self._validate_pipeline_credentials()

        cache_key = (
            task_type,
            source_language,
            target_language,
        )

        if cache_key in self._pipeline_cache:
            return self._pipeline_cache[cache_key]

        if task_type == "asr":

            task = {
                "taskType": "asr",
                "config": {
                    "language": {
                        "sourceLanguage": source_language,
                    }
                },
            }

        elif task_type == "translation":

            if not target_language:
                raise RuntimeError(
                    "Target language is required for translation."
                )

            task = {
                "taskType": "translation",
                "config": {
                    "language": {
                        "sourceLanguage": source_language,
                        "targetLanguage": target_language,
                    }
                },
            }

        elif task_type == "tts":

            task = {
                "taskType": "tts",
                "config": {
                    "language": {
                        "sourceLanguage": source_language,
                    }
                },
            }

        else:
            raise RuntimeError(
                f"Unsupported BHASHINI task: {task_type}"
            )

        payload = {
            "pipelineTasks": [task]
        }

        headers = {
            "Content-Type": "application/json",
            "userID": self.user_id,
            "ulcaApiKey": self.api_key,
        }

        try:
            async with httpx.AsyncClient(
                timeout=30
            ) as client:

                response = await client.post(
                    self.PIPELINE_CONFIG_URL,
                    json=payload,
                    headers=headers,
                )

        except httpx.HTTPError as error:
            raise RuntimeError(
                f"BHASHINI Pipeline Config request failed: {error}"
            )

        if response.status_code != 200:
            raise RuntimeError(
                "BHASHINI Pipeline Config failed "
                f"({response.status_code}): "
                f"{response.text[:500]}"
            )

        try:
            data = response.json()

        except ValueError:
            raise RuntimeError(
                "BHASHINI returned an invalid JSON response."
            )

        pipeline_endpoint = data.get(
            "pipelineInferenceAPIEndPoint"
        )

        if not pipeline_endpoint:
            raise RuntimeError(
                "BHASHINI response does not contain "
                "pipelineInferenceAPIEndPoint."
            )

        callback_url = pipeline_endpoint.get(
            "callbackUrl"
        )

        inference_api_key = pipeline_endpoint.get(
            "inferenceApiKey"
        )

        if not callback_url:
            raise RuntimeError(
                "BHASHINI response does not contain callbackUrl."
            )

        if not inference_api_key:
            raise RuntimeError(
                "BHASHINI response does not contain "
                "inferenceApiKey."
            )

        auth_name = inference_api_key.get("name")
        auth_value = inference_api_key.get("value")

        if not auth_name or not auth_value:
            raise RuntimeError(
                "BHASHINI inference authentication information "
                "is incomplete."
            )

        pipeline_configs = data.get(
            "pipelineResponseConfig",
            [],
        )

        if not pipeline_configs:
            raise RuntimeError(
                "BHASHINI returned no pipeline configuration."
            )

        config = pipeline_configs[0].get(
            "config",
            [],
        )

        if not config:
            raise RuntimeError(
                f"No BHASHINI service is available for "
                f"{task_type} / {source_language}."
            )

        service_id = config[0].get(
            "serviceId"
        )

        if not service_id:
            raise RuntimeError(
                "BHASHINI did not return a serviceId."
            )

        result = {
            "service_id": service_id,
            "callback_url": callback_url,
            "auth_name": auth_name,
            "auth_value": auth_value,
            "raw": data,
        }

        self._pipeline_cache[cache_key] = result

        return result

    # ---------------------------------------------------------
    # Pipeline Compute
    # ---------------------------------------------------------

    async def _compute(
        self,
        callback_url: str,
        auth_name: str,
        auth_value: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:

        headers = {
            "Content-Type": "application/json",
            auth_name: auth_value,
        }

        try:
            async with httpx.AsyncClient(
                timeout=60
            ) as client:

                response = await client.post(
                    callback_url,
                    json=payload,
                    headers=headers,
                )

        except httpx.HTTPError as error:
            raise RuntimeError(
                f"BHASHINI Pipeline Compute request failed: {error}"
            )

        if response.status_code != 200:
            raise RuntimeError(
                "BHASHINI Pipeline Compute failed "
                f"({response.status_code}): "
                f"{response.text[:500]}"
            )

        try:
            return response.json()

        except ValueError:
            raise RuntimeError(
                "BHASHINI returned invalid JSON from Pipeline Compute."
            )

    # ---------------------------------------------------------
    # Speech To Text
    # ---------------------------------------------------------

    async def speech_to_text(
        self,
        audio_bytes: bytes,
        language: str = "hi",
        audio_format: str = "wav",
        sampling_rate: int = 16000,
    ) -> dict[str, Any]:

        if not audio_bytes:
            raise RuntimeError(
                "No audio data was received."
            )

        config = await self._get_pipeline_config(
            task_type="asr",
            source_language=language,
        )

        audio_base64 = base64.b64encode(
            audio_bytes
        ).decode("utf-8")

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "asr",
                    "config": {
                        "language": {
                            "sourceLanguage": language,
                        },
                        "serviceId": config["service_id"],
                        "audioFormat": audio_format,
                        "samplingRate": sampling_rate,
                    },
                }
            ],
            "inputData": {
                "audio": [
                    {
                        "audioContent": audio_base64,
                    }
                ]
            },
        }

        result = await self._compute(
            callback_url=config["callback_url"],
            auth_name=config["auth_name"],
            auth_value=config["auth_value"],
            payload=payload,
        )

        try:
            output = result[
                "pipelineResponse"
            ][0]["output"][0]

            text = output.get(
                "source",
                "",
            )

        except (
            KeyError,
            IndexError,
            TypeError,
        ) as error:

            raise RuntimeError(
                "Unexpected BHASHINI ASR response."
            ) from error

        return {
            "text": text,
            "language": language,
            "raw": result,
        }

    # ---------------------------------------------------------
    # Text To Speech
    # ---------------------------------------------------------

    async def text_to_speech(
        self,
        text: str,
        language: str = "hi",
        gender: str = "female",
        sampling_rate: int = 8000,
    ) -> bytes:

        if not text.strip():
            raise RuntimeError(
                "Text cannot be empty."
            )

        config = await self._get_pipeline_config(
            task_type="tts",
            source_language=language,
        )

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "tts",
                    "config": {
                        "language": {
                            "sourceLanguage": language,
                        },
                        "serviceId": config["service_id"],
                        "gender": gender,
                        "samplingRate": sampling_rate,
                    },
                }
            ],
            "inputData": {
                "input": [
                    {
                        "source": text,
                    }
                ]
            },
        }

        result = await self._compute(
            callback_url=config["callback_url"],
            auth_name=config["auth_name"],
            auth_value=config["auth_value"],
            payload=payload,
        )

        try:
            audio_base64 = result[
                "pipelineResponse"
            ][0]["audio"][0]["audioContent"]

        except (
            KeyError,
            IndexError,
            TypeError,
        ) as error:

            raise RuntimeError(
                "Unexpected BHASHINI TTS response."
            ) from error

        if not audio_base64:
            raise RuntimeError(
                "BHASHINI returned empty TTS audio."
            )

        try:
            return base64.b64decode(
                audio_base64
            )

        except Exception as error:
            raise RuntimeError(
                "Failed to decode BHASHINI TTS audio."
            ) from error

    # ---------------------------------------------------------
    # Translation
    # ---------------------------------------------------------

    async def translate(
        self,
        text: str,
        source_language: str,
        target_language: str,
    ) -> str:

        if not text.strip():
            raise RuntimeError(
                "Text cannot be empty."
            )

        config = await self._get_pipeline_config(
            task_type="translation",
            source_language=source_language,
            target_language=target_language,
        )

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "translation",
                    "config": {
                        "language": {
                            "sourceLanguage": source_language,
                            "targetLanguage": target_language,
                        },
                        "serviceId": config["service_id"],
                    },
                }
            ],
            "inputData": {
                "input": [
                    {
                        "source": text,
                    }
                ]
            },
        }

        result = await self._compute(
            callback_url=config["callback_url"],
            auth_name=config["auth_name"],
            auth_value=config["auth_value"],
            payload=payload,
        )

        try:
            translated_text = result[
                "pipelineResponse"
            ][0]["output"][0]["target"]

        except (
            KeyError,
            IndexError,
            TypeError,
        ) as error:

            raise RuntimeError(
                "Unexpected BHASHINI translation response."
            ) from error

        return translated_text
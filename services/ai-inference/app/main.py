import base64
import io
import cv2
import numpy as np
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import PoseInferenceRequest, PoseInferenceResponse, HealthResponse, PoseMetrics
from .pose_estimator import PoseEstimator
from .metrics import calculate_front_metrics, calculate_side_metrics, merge_metrics
from .calibration import detect_a4_paper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

pose_estimator: PoseEstimator = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pose_estimator
    pose_estimator = PoseEstimator()
    logger.info("AI Inference Service started")
    yield
    # 清理资源
    if pose_estimator is not None:
        del pose_estimator
    logger.info("AI Inference Service stopped")


app = FastAPI(title="PostureTracker AI Inference Service", lifespan=lifespan)

# 内部服务，无需凭证；放宽 origins 即可
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="ok",
        mediapipe_loaded=pose_estimator is not None
    )


def decode_base64_image(b64_string: str):
    """Decode base64 encoded image to OpenCV format"""
    try:
        image_bytes = base64.b64decode(b64_string)
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return image
    except Exception as e:
        logger.error(f"Failed to decode base64 image: {e}")
        return None


def encode_image_to_base64(image: np.ndarray) -> str:
    """Encode OpenCV image to base64 PNG string"""
    success, buffer = cv2.imencode('.png', image)
    if not success:
        return ""
    return base64.b64encode(buffer).decode('utf-8')


async def fetch_url_image(url: str):
    """Fetch image from URL"""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            image_bytes = resp.content

        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return image
    except Exception as e:
        logger.error(f"Failed to fetch image from URL: {e}")
        return None


def _empty_metrics() -> PoseMetrics:
    return PoseMetrics(
        shoulder_roundness=0,
        head_forward=0,
        pelvic_tilt=0,
        shoulder_diff=0,
        knee_hyperextension=0,
        overall_score=0,
    )


@app.post("/infer/pose", response_model=PoseInferenceResponse)
async def infer_pose(request: PoseInferenceRequest):
    global pose_estimator

    try:
        front_image = None
        side_image = None

        # 解码正面照片
        if request.front_image:
            front_image = decode_base64_image(request.front_image)
        elif request.image_url:
            front_image = await fetch_url_image(request.image_url)

        if front_image is None:
            raise HTTPException(status_code=400, detail="Invalid or missing front image")

        # A4 纸校准（基于正面照片）
        cm_per_pixel = detect_a4_paper(front_image)
        if cm_per_pixel is None:
            return PoseInferenceResponse(
                success=False,
                keypoints=[],
                metrics=_empty_metrics(),
                quality_score=0.0,
                error="未检测到 A4 校准纸，请确保照片中包含 A4 纸后重新拍摄",
                error_code="PHOTO_QUALITY_LOW",
            )

        # 解码侧面照片（可选）
        if request.side_image:
            side_image = decode_base64_image(request.side_image)

        # 正面照姿态估计
        front_keypoints, front_annotated, front_quality = pose_estimator.estimate(front_image)

        if front_keypoints is None:
            return PoseInferenceResponse(
                success=False,
                keypoints=[],
                metrics=_empty_metrics(),
                quality_score=0.0,
                error="未检测到人体姿态，请确保全身可见后重新拍摄",
                error_code="POSE_NOT_DETECTED",
            )

        # 关键点置信度校验
        if front_quality < 0.5:
            return PoseInferenceResponse(
                success=False,
                keypoints=[],
                metrics=_empty_metrics(),
                quality_score=front_quality,
                error="关键点检测置信度过低，请确保光线充足且全身可见",
                error_code="POSE_NOT_DETECTED",
            )

        # 正面视角指标
        front_metrics = calculate_front_metrics(front_keypoints, cm_per_pixel)
        annotated_image = front_annotated
        quality_score = front_quality

        # 侧面照处理（增强指标）
        side_metrics = None
        if side_image is not None:
            side_keypoints, side_annotated, side_quality = pose_estimator.estimate(side_image)
            if side_keypoints is not None and side_quality >= 0.5:
                side_metrics = calculate_side_metrics(side_keypoints, cm_per_pixel)
                quality_score = (front_quality + side_quality) / 2

        # 合并指标
        metrics = merge_metrics(front_metrics, side_metrics)

        return PoseInferenceResponse(
            success=True,
            keypoints=front_keypoints,
            metrics=metrics,
            quality_score=quality_score,
            annotated_image=encode_image_to_base64(annotated_image),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Inference error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

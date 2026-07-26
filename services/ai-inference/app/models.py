from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class Keypoint(BaseModel):
    id: int
    name: str
    x: float
    y: float
    z: Optional[float] = None
    visibility: float


class PoseMetrics(BaseModel):
    shoulder_roundness: float = Field(description="圆肩角（度）")
    head_forward: float = Field(description="头前伸（像素比例）")
    pelvic_tilt: float = Field(description="骨盆前倾角（度）")
    shoulder_diff: float = Field(description="高低肩差（像素）")
    knee_hyperextension: float = Field(description="膝关节角度（度）")
    overall_score: float = Field(description="综合评分 0-100")


class PoseInferenceRequest(BaseModel):
    front_image: Optional[str] = Field(None, description="正面照片 base64 编码")
    side_image: Optional[str] = Field(None, description="侧面照片 base64 编码")
    image_url: Optional[str] = Field(None, description="图片URL（备选）")
    photo_type: Optional[str] = "front"


class PoseInferenceResponse(BaseModel):
    success: bool = True
    keypoints: List[Any] = []
    metrics: PoseMetrics
    quality_score: float
    annotated_image: Optional[str] = Field(None, description="标注图 base64 编码的 PNG")
    error: Optional[str] = None
    error_code: Optional[str] = Field(None, description="业务错误码：POSE_NOT_DETECTED, PHOTO_QUALITY_LOW")


class HealthResponse(BaseModel):
    status: str
    mediapipe_loaded: bool

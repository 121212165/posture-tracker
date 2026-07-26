"""
体态指标计算模块
基于 MediaPipe BlazePose 33 关键点，计算 5 项核心体态指标

指标规格（对齐设计文档第 6 节）：
| 指标 | 视角 | 单位 | 正常范围 | 异常阈值 |
|------|------|------|----------|----------|
| 圆肩角 | 正面 | 度 | <10° | >15° |
| 头前伸 | 侧面 | cm | <5cm | >8cm |
| 骨盆前倾 | 正面 | 度 | 0-10° | >15° |
| 高低肩 | 正面 | cm | <1cm | >2cm |
| 膝超伸 | 侧面 | 度 | 170-180° | >180° |
"""
import numpy as np
from typing import List, Dict, Tuple, Optional
from .models import PoseMetrics


def calculate_angle(p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> float:
    """计算三点形成的角度（p2 为顶点）"""
    v1 = p1 - p2
    v2 = p3 - p2
    cosine = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-8)
    cosine = np.clip(cosine, -1.0, 1.0)
    angle = np.degrees(np.arccos(cosine))
    return float(angle)


def calculate_horizontal_angle(p1: np.ndarray, p2: np.ndarray) -> float:
    """计算两点连线与水平线的夹角（度）"""
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    angle = np.degrees(np.arctan2(abs(dy), abs(dx) + 1e-8))
    return float(angle)


def get_kp(keypoints: List[Dict], name: str) -> np.ndarray:
    """按名称获取关键点坐标"""
    for kp in keypoints:
        if kp["name"] == name:
            return np.array([kp["x"], kp["y"]])
    return np.array([0.0, 0.0])


def get_kp_with_visibility(keypoints: List[Dict], name: str) -> Tuple[np.ndarray, float]:
    """按名称获取关键点坐标和可见度"""
    for kp in keypoints:
        if kp["name"] == name:
            return np.array([kp["x"], kp["y"]]), kp.get("visibility", 0.0)
    return np.array([0.0, 0.0]), 0.0


def _normalize_score(value: float, normal_max: float, abnormal_min: float) -> float:
    """
    按阈值归一化评分：
    - value < normal_max: 满分 100
    - value >= abnormal_min: 0 分
    - 中间线性插值
    """
    if value < normal_max:
        return 100.0
    if value >= abnormal_min:
        return 0.0
    return float(100.0 * (abnormal_min - value) / (abnormal_min - normal_max))


def calculate_front_metrics(keypoints: List[Dict], cm_per_pixel: float) -> PoseMetrics:
    """
    正面视角指标计算：
    - shoulder_roundness（圆肩角）
    - shoulder_diff（高低肩，cm）
    - pelvic_tilt（骨盆倾斜）
    """
    left_shoulder = get_kp(keypoints, "left_shoulder")
    right_shoulder = get_kp(keypoints, "right_shoulder")
    left_hip = get_kp(keypoints, "left_hip")
    right_hip = get_kp(keypoints, "right_hip")

    # 圆肩角：双肩连线与水平线夹角（度）
    shoulder_roundness = calculate_horizontal_angle(left_shoulder, right_shoulder)

    # 高低肩：双肩 Y 坐标差（像素 → cm）
    shoulder_diff = abs(left_shoulder[1] - right_shoulder[1]) * cm_per_pixel

    # 骨盆倾斜：双髋连线与水平线夹角（度）
    pelvic_tilt = calculate_horizontal_angle(left_hip, right_hip)

    # 正面视角无法准确计算头前伸和膝超伸，填 0
    head_forward = 0.0
    knee_hyperextension = 0.0

    overall_score = _calculate_overall_score(
        shoulder_roundness, head_forward, pelvic_tilt, shoulder_diff, knee_hyperextension
    )

    return PoseMetrics(
        shoulder_roundness=round(shoulder_roundness, 1),
        head_forward=round(head_forward, 1),
        pelvic_tilt=round(pelvic_tilt, 1),
        shoulder_diff=round(shoulder_diff, 1),
        knee_hyperextension=round(knee_hyperextension, 1),
        overall_score=round(overall_score, 1),
    )


def calculate_side_metrics(keypoints: List[Dict], cm_per_pixel: float) -> PoseMetrics:
    """
    侧面视角指标计算：
    - head_forward（头前伸，cm）：耳垂相对肩峰的水平距离
    - knee_hyperextension（膝超伸，度）：髋-膝-踝角度
    """
    # 头前伸：取可见度高的耳朵，计算相对肩峰中点的水平距离
    left_ear, left_vis = get_kp_with_visibility(keypoints, "left_ear")
    right_ear, right_vis = get_kp_with_visibility(keypoints, "right_ear")
    left_shoulder = get_kp(keypoints, "left_shoulder")
    right_shoulder = get_kp(keypoints, "right_shoulder")
    mid_shoulder = (left_shoulder + right_shoulder) / 2

    if left_vis >= right_vis and left_vis > 0:
        ear = left_ear
    elif right_vis > 0:
        ear = right_ear
    else:
        ear = (left_ear + right_ear) / 2

    head_forward = abs(ear[0] - mid_shoulder[0]) * cm_per_pixel

    # 膝超伸：髋-膝-踝角度（侧面视角）
    left_hip = get_kp(keypoints, "left_hip")
    right_hip = get_kp(keypoints, "right_hip")
    left_knee = get_kp(keypoints, "left_knee")
    right_knee = get_kp(keypoints, "right_knee")
    left_ankle = get_kp(keypoints, "left_ankle")
    right_ankle = get_kp(keypoints, "right_ankle")

    left_knee_angle = calculate_angle(left_hip, left_knee, left_ankle)
    right_knee_angle = calculate_angle(right_hip, right_knee, right_ankle)
    knee_hyperextension = max(left_knee_angle, right_knee_angle)

    # 侧面视角无法准确计算圆肩、高低肩、骨盆倾斜，填 0
    shoulder_roundness = 0.0
    shoulder_diff = 0.0
    pelvic_tilt = 0.0

    overall_score = _calculate_overall_score(
        shoulder_roundness, head_forward, pelvic_tilt, shoulder_diff, knee_hyperextension
    )

    return PoseMetrics(
        shoulder_roundness=round(shoulder_roundness, 1),
        head_forward=round(head_forward, 1),
        pelvic_tilt=round(pelvic_tilt, 1),
        shoulder_diff=round(shoulder_diff, 1),
        knee_hyperextension=round(knee_hyperextension, 1),
        overall_score=round(overall_score, 1),
    )


def merge_metrics(front: PoseMetrics, side: Optional[PoseMetrics]) -> PoseMetrics:
    """
    合并正面和侧面指标：
    - shoulder_roundness, shoulder_diff, pelvic_tilt 取正面
    - head_forward, knee_hyperextension 取侧面（若可用）
    """
    if side is None:
        return front

    head_forward = side.head_forward if side.head_forward > 0 else front.head_forward
    knee_hyperextension = side.knee_hyperextension if side.knee_hyperextension > 0 else front.knee_hyperextension

    overall_score = _calculate_overall_score(
        front.shoulder_roundness, head_forward, front.pelvic_tilt,
        front.shoulder_diff, knee_hyperextension
    )

    return PoseMetrics(
        shoulder_roundness=front.shoulder_roundness,
        head_forward=round(head_forward, 1),
        pelvic_tilt=front.pelvic_tilt,
        shoulder_diff=front.shoulder_diff,
        knee_hyperextension=round(knee_hyperextension, 1),
        overall_score=round(overall_score, 1),
    )


def _calculate_overall_score(
    shoulder_roundness: float,
    head_forward: float,
    pelvic_tilt: float,
    shoulder_diff: float,
    knee_hyperextension: float,
) -> float:
    """
    按设计阈值归一化计算综合评分（0-100）
    每个指标：正常范围得满分，超出异常阈值得 0 分，中间线性插值
    """
    scores = []

    # 圆肩角：正常 <10°，异常 >15°
    scores.append(_normalize_score(shoulder_roundness, 10, 15))

    # 头前伸：正常 <5cm，异常 >8cm
    scores.append(_normalize_score(head_forward, 5, 8))

    # 骨盆倾斜：正常 <10°，异常 >15°
    scores.append(_normalize_score(pelvic_tilt, 10, 15))

    # 高低肩：正常 <1cm，异常 >2cm
    scores.append(_normalize_score(shoulder_diff, 1, 2))

    # 膝超伸：正常 <180°，异常 >185°
    scores.append(_normalize_score(knee_hyperextension, 180, 185))

    return float(np.mean(scores))

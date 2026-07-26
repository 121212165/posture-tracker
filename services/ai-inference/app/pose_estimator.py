import os
import mediapipe as mp
import cv2
import numpy as np
from typing import List, Tuple, Optional
import logging

logger = logging.getLogger(__name__)

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

BLAZEPOSE_KEYPOINT_NAMES = [
    "nose", "left_eye_inner", "left_eye", "left_eye_outer",
    "right_eye_inner", "right_eye", "right_eye_outer",
    "left_ear", "right_ear", "mouth_left", "mouth_right",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_pinky", "right_pinky",
    "left_index", "right_index", "left_thumb", "right_thumb",
    "left_hip", "right_hip", "left_knee", "right_knee",
    "left_ankle", "right_ankle", "left_heel", "right_heel",
    "left_foot_index", "right_foot_index"
]


class PoseEstimator:
    def __init__(self):
        # 支持环境变量调优：MODEL_COMPLEXITY (0/1/2), MIN_DETECTION_CONFIDENCE (0.0-1.0)
        model_complexity = int(os.getenv('MODEL_COMPLEXITY', '2'))
        min_detection_confidence = float(os.getenv('MIN_DETECTION_CONFIDENCE', '0.5'))

        self.pose = mp_pose.Pose(
            static_image_mode=True,
            model_complexity=model_complexity,
            enable_segmentation=False,
            min_detection_confidence=min_detection_confidence
        )
        logger.info(
            f"MediaPipe Pose initialized (complexity={model_complexity}, "
            f"min_detection_confidence={min_detection_confidence})"
        )

    def estimate(self, image: np.ndarray) -> Tuple[Optional[List[dict]], Optional[np.ndarray], float]:
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.pose.process(image_rgb)

        if not results.pose_landmarks:
            return None, None, 0.0

        h, w = image.shape[:2]
        keypoints = []
        visibilities = []

        for idx, landmark in enumerate(results.pose_landmarks.landmark):
            if idx < len(BLAZEPOSE_KEYPOINT_NAMES):
                kp = {
                    "id": idx,
                    "name": BLAZEPOSE_KEYPOINT_NAMES[idx],
                    "x": landmark.x * w,
                    "y": landmark.y * h,
                    "z": landmark.z,
                    "visibility": landmark.visibility
                }
                keypoints.append(kp)
                visibilities.append(landmark.visibility)

        avg_visibility = float(np.mean(visibilities)) if visibilities else 0.0

        annotated_image = image.copy()
        mp_drawing.draw_landmarks(
            annotated_image,
            results.pose_landmarks,
            mp_pose.POSE_CONNECTIONS,
            mp_drawing_styles.get_default_pose_landmarks_style()
        )

        return keypoints, annotated_image, avg_visibility

    def __del__(self):
        if hasattr(self, 'pose'):
            self.pose.close()

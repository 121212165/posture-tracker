"""
A4 纸校准模块
通过检测照片中的 A4 纸（21cm × 29.7cm）计算像素到物理尺寸的换算比例
"""
import cv2
import numpy as np
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# A4 纸宽度（短边）21cm
A4_WIDTH_CM = 21.0


def detect_a4_paper(image: np.ndarray) -> Optional[float]:
    """
    检测图像中的 A4 纸并返回 cm_per_pixel 换算比例

    策略：
    1. 灰度化 + 高斯模糊 + Canny 边缘检测
    2. 查找轮廓，筛选四边形且面积合理的轮廓
    3. 取最接近 A4 宽高比的四边形，用其短边像素长度计算比例

    Args:
        image: BGR 格式的图像

    Returns:
        cm_per_pixel 换算比例，未检测到返回 None
    """
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edged = cv2.Canny(blurred, 50, 150)

        contours, _ = cv2.findContours(edged, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

        image_area = image.shape[0] * image.shape[1]
        candidates = []

        for contour in contours:
            area = cv2.contourArea(contour)
            # 面积过小（< 图像 1%）或过大（> 图像 50%）的跳过
            if area < image_area * 0.01 or area > image_area * 0.5:
                continue

            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)

            # 只保留四边形
            if len(approx) != 4:
                continue

            # 计算四条边长度
            points = approx.reshape(-1, 2)
            edges = []
            for i in range(4):
                p1 = points[i]
                p2 = points[(i + 1) % 4]
                edges.append(np.linalg.norm(p2 - p1))

            edges.sort()
            short_edge = edges[0]  # 最短边
            long_edge = edges[2]   # 次长边（排除对角线）

            if short_edge <= 0:
                continue

            # A4 宽高比约 1:1.414，允许 30% 误差
            ratio = long_edge / short_edge
            if not (1.0 <= ratio <= 1.8):
                continue

            candidates.append((short_edge, area))

        if not candidates:
            logger.warning("No A4 paper detected in image")
            return None

        # 取面积最大的候选（最可能是 A4 纸）
        candidates.sort(key=lambda x: x[1], reverse=True)
        short_edge_pixels = candidates[0][0]

        cm_per_pixel = A4_WIDTH_CM / short_edge_pixels
        logger.info(f"A4 paper detected: short_edge={short_edge_pixels:.1f}px, cm_per_pixel={cm_per_pixel:.4f}")
        return cm_per_pixel

    except Exception as e:
        logger.error(f"A4 paper detection failed: {e}")
        return None

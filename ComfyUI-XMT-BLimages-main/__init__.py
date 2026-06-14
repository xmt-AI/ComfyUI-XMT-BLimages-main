from .batch_load_images import BatchLoadImages, VNCCS_PositionControl, VNCCS_VisualPositionControl

WEB_DIRECTORY = "./web"

NODE_CLASS_MAPPINGS = {
    "BatchLoadImages": BatchLoadImages,              # 兼容保留旧版 ID 节点
    "ComfyUI_xmt_BLImages": BatchLoadImages,         # 全新的熊猫头专属 ID 节点
    "VNCCS_PositionControl": VNCCS_PositionControl,
    "VNCCS_VisualPositionControl": VNCCS_VisualPositionControl,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "BatchLoadImages": "熊猫头批量图片加载",
    "ComfyUI_xmt_BLImages": "熊猫头批量图片加载",
    "VNCCS_PositionControl": "VNCCS Position Control (Prompt)",
    "VNCCS_VisualPositionControl": "VNCCS Visual Position Control (Prompt)",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
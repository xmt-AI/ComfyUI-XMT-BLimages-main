from .batch_load_images import BatchLoadImages, VNCCS_PositionControl, VNCCS_VisualPositionControl

WEB_DIRECTORY = "./web"

NODE_CLASS_MAPPINGS = {
    "BatchLoadImages": BatchLoadImages,
    "ComfyUI_xmt_BLImages": BatchLoadImages,
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
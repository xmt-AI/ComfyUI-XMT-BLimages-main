from .batch_load_images import (
    BatchLoadImages,
    ExternalImageUpload,
    NodeSelectSwitch,
    VNCCS_PositionControl,
    VNCCS_VisualPositionControl,
)

WEB_DIRECTORY = "./web"

NODE_CLASS_MAPPINGS = {
    "ComfyUI_xmt_BLImages": BatchLoadImages,
    "ComfyUI_xmt_NodeSelectSwitch": NodeSelectSwitch,
    "ComfyUI_xmt_ExternalImageUpload": ExternalImageUpload,
    "VNCCS_PositionControl": VNCCS_PositionControl,
    "VNCCS_VisualPositionControl": VNCCS_VisualPositionControl,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUI_xmt_BLImages": "\u718a\u732b\u5934\u6279\u91cf\u56fe\u7247\u52a0\u8f7d",
    "ComfyUI_xmt_NodeSelectSwitch": "\u718a\u732b\u5934\u5c01\u88c5\u8282\u70b9\u5207\u6362",
    "ComfyUI_xmt_ExternalImageUpload": "\u718a\u732b\u5934\u5916\u7f6e\u56fe\u7247\u52a0\u8f7d",
    "VNCCS_PositionControl": "VNCCS Position Control (Prompt)",
    "VNCCS_VisualPositionControl": "VNCCS Visual Position Control (Prompt)",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]

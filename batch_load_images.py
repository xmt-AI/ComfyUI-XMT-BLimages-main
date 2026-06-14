import os
import hashlib
import json

import numpy as np
import torch
from PIL import Image, ImageOps, ImageSequence

import folder_paths
import node_helpers


class BatchLoadImages:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image_list": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": "",
                    },
                ),
                "max_images": ("INT", {"default": 0, "min": 0, "max": 100000, "step": 1}),
                "mode": (["batch", "single"], {"default": "batch"}),
                "index": ("INT", {"default": 0, "min": 0, "max": 100000, "step": 1}),
            }
        }

    # 修改为你专属的分类目录
    CATEGORY = "ComfyUI-xmt-BLImages"

    RETURN_TYPES = ("IMAGE", "STRING")
    RETURN_NAMES = ("images", "filenames")
    FUNCTION = "load_images"

    def load_images(self, image_list: str, max_images: int, mode: str, index: int):
        names = [x.strip() for x in (image_list or "").splitlines()]
        names = [x for x in names if x]

        if max_images and max_images > 0:
            names = names[:max_images]

        if mode == "single":
            if index < 0:
                index = 0
            if index >= len(names):
                index = len(names) - 1
            names = [names[index]]

        if len(names) == 0:
            raise ValueError("图片列表为空 (image_list is empty)")

        output_images = []
        output_names = []
        excluded_formats = ["MPO"]

        global_target_w = None
        global_target_h = None

        for name in names:
            if not folder_paths.exists_annotated_filepath(name):
                continue

            image_path = folder_paths.get_annotated_filepath(name)
            img = node_helpers.pillow(Image.open, image_path)

            frames = []

            for i in ImageSequence.Iterator(img):
                i = node_helpers.pillow(ImageOps.exif_transpose, i)

                if i.mode == "I":
                    i = i.point(lambda p: p * (1 / 255))
                pil_image = i.convert("RGB")

                current_w, current_h = pil_image.size

                if global_target_w is None or global_target_h is None:
                    global_target_w = current_w
                    global_target_h = current_h

                # 💡 核心保护机制：如果是在“批量打包”模式下，发现尺寸不统一，立刻中断并给出明确的中文建议
                if mode == "batch" and (current_w != global_target_w or current_h != global_target_h):
                    raise ValueError(f"\n\n【尺寸冲突报错】\n图片 '{name}' ({current_w}x{current_h}) 与第一张图 ({global_target_w}x{global_target_h}) 尺寸不一致！\n\n💡 解决方案：\n既然你需要保留每一张图原本的像素和比例，请不要使用“批量模式”或系统自带的运行队列。\n请直接点击面板上的【逐张执行】按钮！它能完美保持每张图 100% 原分辨率进行跑图！\n\n")

                # 100% 原汁原味提取原图像素，绝不进行任何裁剪或缩放
                arr = np.array(pil_image).astype(np.float32) / 255.0
                tensor = torch.from_numpy(arr)[None,]
                frames.append(tensor)

            if len(frames) == 0:
                continue

            if len(frames) > 1 and img.format not in excluded_formats:
                image_tensor = torch.cat(frames, dim=0)
            else:
                image_tensor = frames[0]

            output_images.append(image_tensor)
            output_names.append(name)

        if len(output_images) == 0:
            raise ValueError("未找到有效的图片")

        output_image = torch.cat(output_images, dim=0)
        return (output_image, "\n".join(output_names))

    @classmethod
    def IS_CHANGED(s, image_list: str, max_images: int, mode: str, index: int):
        m = hashlib.sha256()
        names = [x.strip() for x in (image_list or "").splitlines()]
        names = [x for x in names if x]
        if max_images and max_images > 0:
            names = names[:max_images]

        if mode == "single":
            if index < 0:
                index = 0
            if index >= len(names):
                index = len(names) - 1
            names = names[:1] if len(names) == 0 else [names[index]]

        m.update(str(mode).encode("utf-8"))
        m.update(str(index).encode("utf-8"))
        m.update(str(max_images).encode("utf-8"))
        for name in names:
            m.update(name.encode("utf-8"))
            if folder_paths.exists_annotated_filepath(name):
                image_path = folder_paths.get_annotated_filepath(name)
                if os.path.isfile(image_path):
                    with open(image_path, "rb") as f:
                        m.update(f.read())
        return m.digest().hex()

    @classmethod
    def VALIDATE_INPUTS(s, image_list: str, max_images: int, mode: str, index: int):
        names = [x.strip() for x in (image_list or "").splitlines()]
        names = [x for x in names if x]
        if max_images and max_images > 0:
            names = names[:max_images]

        if mode == "single":
            if len(names) == 0:
                return "image_list is empty"
            if index < 0:
                return "index must be >= 0"
            if index >= len(names):
                return f"index out of range (0..{len(names)-1})"

        if len(names) == 0:
            return "image_list is empty"

        valid = False
        for name in names:
            if folder_paths.exists_annotated_filepath(name):
                valid = True
                break

        if not valid:
            return "No valid images in image_list"

        return True


class VNCCS_PositionControl:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "azimuth": ("INT", {"default": 0, "min": 0, "max": 360, "step": 45, "display": "slider", "tooltip": "Angle of the camera around the subject (0=Front, 90=Right, 180=Back)"}),
                "elevation": ("INT", {"default": 0, "min": -30, "max": 60, "step": 30, "display": "slider", "tooltip": "Vertical angle of the camera (-30=Low, 0=Eye Level, 60=High)"}),
                "distance": (["close-up", "medium shot", "wide shot"], {"default": "medium shot"}),
                "include_trigger": ("BOOLEAN", {"default": True, "tooltip": "Include <sks> trigger word"}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    CATEGORY = "VNCCS"
    FUNCTION = "generate_prompt"

    def generate_prompt(self, azimuth, elevation, distance, include_trigger):
        azimuth = int(azimuth) % 360
        azimuth_map = {0: "front view", 45: "front-right quarter view", 90: "right side view", 135: "back-right quarter view", 180: "back view", 225: "back-left quarter view", 270: "left side view", 315: "front-left quarter view"}
        closest_azimuth = min(azimuth_map.keys(), key=lambda x: abs(x - azimuth)) if azimuth <= 337.5 else 0
        az_str = azimuth_map[closest_azimuth]

        elevation_map = {-30: "low-angle shot", 0: "eye-level shot", 30: "elevated shot", 60: "high-angle shot"}
        closest_elevation = min(elevation_map.keys(), key=lambda x: abs(x - elevation))
        el_str = elevation_map[closest_elevation]

        parts = []
        if include_trigger: parts.append("<sks>")
        parts.append(az_str)
        parts.append(el_str)
        parts.append(distance)

        return (" ".join(parts),)


class VNCCS_VisualPositionControl(VNCCS_PositionControl):
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"camera_data": ("STRING", {"default": "{}", "hidden": True})}}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    CATEGORY = "VNCCS"
    FUNCTION = "generate_prompt_from_json"

    def generate_prompt_from_json(self, camera_data):
        try:
            data = json.loads(camera_data)
        except json.JSONDecodeError:
            data = {"azimuth": 0, "elevation": 0, "distance": "medium shot", "include_trigger": True}

        return self.generate_prompt(
            data.get("azimuth", 0), data.get("elevation", 0), data.get("distance", "medium shot"), data.get("include_trigger", True)
        )

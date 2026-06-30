# ComfyUI XMT Batch Image Loader

ComfyUI XMT Batch Image Loader is a ComfyUI custom node package for uploading, previewing, managing, and executing image lists. It is designed for workflows that need to preserve each source image's original resolution while still allowing convenient batch-style image selection.

The plugin supports both the normal ComfyUI canvas and external web wrappers that need to render a native ComfyUI upload field.

## Features

- Manage a list of uploaded images inside one main loader node.
- Preview uploaded images with responsive sizing and preserved aspect ratios.
- Replace images, append images, upload a folder, delete individual images, and clear the list.
- Queue one workflow run per image with sequential execution controls.
- Use an external native upload node for web-wrapper compatibility.
- Keep external upload data separate from the index control through a dedicated `append` type.
- Pass execution actions through a dedicated `control` type.
- Keep the original mixed-size protection in batch mode.

## Installation

Copy this folder into your ComfyUI custom nodes directory:

```text
ComfyUI/custom_nodes/ComfyUI-XMT-BLimages-main
```

Restart ComfyUI after installation or after updating this plugin.

Search for `xmt` in the node menu, or open the `ComfyUI-xmt-BLImages` category.

## Nodes

### Batch Image Loader

Class ID:

```text
ComfyUI_xmt_BLImages
```

This is the main node. It stores an image filename list, shows an image preview grid, and outputs ComfyUI `IMAGE` data plus the loaded filenames.

Inputs:

- `image_list`: Internal newline-separated image filename list managed by the frontend UI.
- `max_images`: Maximum number of images to use. Set `0` for no limit.
- `mode`: `batch` or `single`.
- `index`: Image index used in `single` mode.
- `append`: Optional external upload input.
- `control`: Optional action-control input from the switch node.

Outputs:

- `images`: ComfyUI `IMAGE` output.
- `filenames`: Newline-separated loaded filenames.

Canvas actions:

- 重新上传: replace the current image list.
- 追加图片: append images to the current image list.
- 上传文件夹: upload images from a selected folder.
- 逐张执行: queue one workflow run per image.
- 执行首张: queue only the first image.
- 清空: remove every image from the list.

### External Image Upload

Class ID:

```text
ComfyUI_xmt_ExternalImageUpload
```

This node is intended for web wrappers and user-facing upload forms. It keeps a native ComfyUI upload input:

```python
{"image_upload": True}
```

Input:

- `image`: Native ComfyUI image upload/select field.

Output:

- `append`: Dedicated `XMT_BLIMAGE_APPEND` output.

Connect `append` to the Batch Image Loader `append` input. In the normal ComfyUI canvas, selecting or uploading an image through this node also appends the selected filename to the Batch Image Loader preview list when possible.

### Node Select Switch

Class ID:

```text
ComfyUI_xmt_NodeSelectSwitch
```

This helper node controls upload and execution actions.

Inputs:

- `index`: Integer index value.
- `button`: Action selector.

Outputs:

- `index`: Connect to the Batch Image Loader `index` input.
- `control`: Connect to the Batch Image Loader `control` input.

Supported actions:

- 重新上传
- 追加图片
- 上传文件夹
- 逐张执行
- 执行首张
- 清空

### VNCCS Position Control

Class ID:

```text
VNCCS_PositionControl
```

This node generates a prompt string from camera angle and distance settings.

Inputs:

- `azimuth`: Horizontal camera angle.
- `elevation`: Vertical camera angle.
- `distance`: `close-up`, `medium shot`, or `wide shot`.
- `include_trigger`: Whether to include the `<sks>` trigger word.

Output:

- `prompt`: Generated prompt text.

### VNCCS Visual Position Control

Class ID:

```text
VNCCS_VisualPositionControl
```

This is a UI-backed version of `VNCCS_PositionControl`.

Input:

- `camera_data`: Hidden JSON string used by the frontend widget.

Output:

- `prompt`: Generated prompt text.

## Recommended Wiring

Use this wiring for the complete workflow:

```text
Node Select Switch.index      -> Batch Image Loader.index
Node Select Switch.control    -> Batch Image Loader.control
External Image Upload.append  -> Batch Image Loader.append
Batch Image Loader.images     -> downstream image nodes
```

When `逐张执行` is selected, pressing the normal ComfyUI queue button is converted by the frontend extension into multiple queued prompts. Each queued prompt contains only one image filename. This avoids mixed-size tensor errors while preserving the original image resolution.

When `执行首张` is selected, only the first image is queued.

The multi-prompt behavior depends on the frontend extension. If frontend interception is unavailable, the backend only falls back to single-image loading for the current selected index or the first image; it does not automatically queue every image.

## Web Wrapper Integration

For external web applications, expose `ComfyUI_xmt_ExternalImageUpload.image` as the user-facing upload field. This is the most wrapper-friendly input because it uses ComfyUI's native `image_upload` metadata.

Recommended web-wrapper flow:

1. Include `ComfyUI_xmt_ExternalImageUpload` in the workflow.
2. Render its `image` input in the web UI.
3. Connect its `append` output to `ComfyUI_xmt_BLImages.append`.
4. Connect `ComfyUI_xmt_NodeSelectSwitch.control` to `ComfyUI_xmt_BLImages.control`.
5. Use `逐张执行` when the workflow should process all images one by one.

For multi-image upload interfaces, upload each file through ComfyUI's upload API and pass the returned filenames into the Batch Image Loader image list, or create repeated External Image Upload nodes depending on your wrapper architecture.

## Dimension Behavior

In `batch` mode, all images must have the same pixel dimensions because ComfyUI image batches require tensors with matching shapes. If dimensions differ, the node raises a size-conflict error.

Use `逐张执行` for mixed-size images. It queues one image per prompt and preserves each image's original resolution and aspect ratio.

## Updating

After updating the plugin:

1. Restart ComfyUI.
2. Hard-refresh the browser page.
3. Re-add old nodes if their inputs or outputs still show stale ports.

If an old External Image Upload node still shows extra outputs such as `image` or `mask`, delete that old node and add the External Image Upload node again. The current node should expose only the `append` output.

## Development Files

- Backend nodes: `batch_load_images.py`
- Frontend extension: `web/batch_load_images.js`
- Node registration: `__init__.py`

Do not upload Python cache files to GitHub:

```text
__pycache__/
*.pyc
```

## Troubleshooting

If a node does not appear after updating:

1. Restart ComfyUI.
2. Hard-refresh the browser.
3. Confirm the folder is inside `custom_nodes`.

If a web wrapper shows a text field instead of an upload field:

1. Confirm it is rendering `ComfyUI_xmt_ExternalImageUpload.image`.
2. Confirm the input metadata includes `{"image_upload": True}`.
3. Confirm the wrapper supports ComfyUI native image upload fields.

If mixed-size images fail in `batch` mode, use `逐张执行` and connect the switch node `control` output to the Batch Image Loader `control` input.

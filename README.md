<<<<<<< HEAD
批量加载图像，批量执行
=======
# ComfyUI XMT Batch Image Loader

ComfyUI XMT Batch Image Loader is a custom node package for managing multiple uploaded images, appending images from an external native upload node, and running image workflows one image at a time without resizing or cropping the source images.

The package is designed for both the normal ComfyUI canvas and web-wrapper workflows that need a native ComfyUI upload field.

## Features

- Batch image list management inside a custom ComfyUI node.
- Responsive preview grid that preserves thumbnail aspect ratios.
- Replace, append, folder upload, delete, and clear image actions.
- Sequential execution that queues one workflow run per image.
- Native external image upload input for web-wrapper compatibility.
- Dedicated `append` input/output type for adding images to the batch loader.
- Dedicated `control` input/output type for switch-node execution control.
- Size-conflict protection in batch mode when images have different dimensions.

## Installation

Copy this folder into your ComfyUI `custom_nodes` directory:

```text
ComfyUI/custom_nodes/ComfyUI-XMT-BLimages-main
```

Restart ComfyUI after installation or after updating the plugin.

Search for `xmt` or open the `ComfyUI-xmt-BLImages` category.

## Nodes

### Batch Image Loader

Display name:

```text
熊猫头批量图片加载
```

Class ID:

```text
ComfyUI_xmt_BLImages
```

This is the main node. It stores and previews the image list, then outputs ComfyUI `IMAGE` data and the loaded filenames.

Inputs:

- `image_list`: Internal newline-separated image filename list.
- `max_images`: Limits how many images are used. Set `0` for no limit.
- `mode`: `batch` or `single`.
- `index`: Selects the image used in `single` mode.
- `append`: Optional input for external image uploads.
- `control`: Optional input from the switch node.

Outputs:

- `images`: ComfyUI `IMAGE`.
- `filenames`: Newline-separated filenames.

Canvas controls:

- `重新上传`: Replace the image list.
- `追加图片`: Add images to the image list.
- `上传文件夹`: Upload images from a folder.
- `逐张执行`: Queue one workflow run per image.
- `执行首张`: Queue only the first image.
- `清空`: Clear the image list.

### External Image Upload

Display name:

```text
熊猫头外置图片加载
```

Class ID:

```text
ComfyUI_xmt_ExternalImageUpload
```

This node is intended for web-wrapper upload forms. It uses ComfyUI's native image upload metadata:

```python
{"image_upload": True}
```

Input:

- `image`: Native ComfyUI upload/select image field.

Output:

- `append`: Dedicated `XMT_BLIMAGE_APPEND` output.

Connect `append` to the Batch Image Loader `append` input. In the normal ComfyUI canvas, selecting or uploading an image through this node also appends the image filename to the Batch Image Loader preview list when possible.

### Node Select Switch

Display name:

```text
熊猫头封装节点切换
```

Class ID:

```text
ComfyUI_xmt_NodeSelectSwitch
```

This node controls upload and execution actions.

Inputs:

- `index`: Integer index value.
- `button`: Action selector.

Outputs:

- `index`: Connect to the Batch Image Loader `index` input.
- `control`: Connect to the Batch Image Loader `control` input.

Actions:

- `重新上传`
- `追加图片`
- `上传文件夹`
- `逐张执行`
- `执行首张`
- `清空`

## Recommended Connections

Use this wiring for the full workflow:

```text
Node Select Switch.index   -> Batch Image Loader.index
Node Select Switch.control -> Batch Image Loader.control
External Image Upload.append -> Batch Image Loader.append
Batch Image Loader.images -> downstream image nodes
```

When `逐张执行` is selected, pressing the normal ComfyUI queue button is intercepted by the frontend extension and converted into multiple queued prompts. Each queued prompt contains only one image filename, which avoids mixed-size batch tensor errors.

When `执行首张` is selected, the frontend queues only the first image.

If the frontend interception is unavailable, the backend still treats `逐张执行` and `执行首张` control values as `single` mode as a fallback.

## Web Wrapper Integration

For web applications, use `ComfyUI_xmt_ExternalImageUpload.image` as the user-facing upload field. This input should be recognized by wrappers that support ComfyUI's native `image_upload` metadata.

Recommended web flow:

1. Include `ComfyUI_xmt_ExternalImageUpload` in the workflow.
2. Expose its `image` input in the web UI.
3. Connect its `append` output to `ComfyUI_xmt_BLImages.append`.
4. Connect `ComfyUI_xmt_NodeSelectSwitch.control` to `ComfyUI_xmt_BLImages.control`.
5. Select `逐张执行` when the workflow should process all images one by one.

For multi-image uploads in a custom web wrapper, upload each file through ComfyUI's upload API and pass the returned filenames into the Batch Image Loader image list, or use repeated external upload nodes depending on your wrapper architecture.

## Dimension Behavior

In `batch` mode, all images must have the same pixel dimensions because ComfyUI image batches require tensors with matching shapes. If dimensions differ, the node raises a clear size-conflict error.

Use `逐张执行` for mixed-size images. This queues one image per prompt and preserves each image's original resolution and aspect ratio.

## Updating

After updating the plugin:

1. Restart ComfyUI.
2. Hard-refresh the browser page.
3. Re-add old nodes if their inputs or outputs still show stale ports.

If an old External Image Upload node still shows extra outputs such as `image` or `mask`, delete that old node and add `熊猫头外置图片加载` again. The current node should expose only the `append` output.

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

If the node does not appear:

1. Restart ComfyUI.
2. Hard-refresh the browser.
3. Confirm the folder is inside `custom_nodes`.

If a web wrapper shows a text field instead of an upload field:

1. Confirm it is rendering `ComfyUI_xmt_ExternalImageUpload.image`.
2. Confirm the input metadata includes `{"image_upload": True}`.
3. Confirm the wrapper supports ComfyUI native image upload fields.

If mixed-size images fail in `batch` mode, switch to `逐张执行` and connect the switch node `control` output to the Batch Image Loader `control` input.
>>>>>>> b6e6985 (Update external upload workflow documentation)

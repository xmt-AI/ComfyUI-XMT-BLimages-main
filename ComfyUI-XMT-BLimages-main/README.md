# ComfyUI XMT Batch Image Loader

A ComfyUI custom node package for batch image loading, external image upload linking, and workflow-friendly image list management.

## Features

- Batch load multiple input images as a ComfyUI `IMAGE` batch.
- Preview uploaded images directly inside the batch loader node.
- Add, replace, delete, and clear images from the image list.
- Run the current workflow image by image with sequential execution controls.
- Resize-aware preview grid that keeps image aspect ratios intact.
- External upload node that uses ComfyUI's native image upload field.
- Dedicated `append` connection type so external uploads do not conflict with the `index` control input.
- Switch/control node for selecting upload and execution actions from a compact node.

## Installation

1. Copy this folder into your ComfyUI `custom_nodes` directory:

   ```text
   ComfyUI/custom_nodes/ComfyUI-XMT-BLimages-main
   ```

2. Restart ComfyUI.

3. Search for `xmt` or open the `ComfyUI-xmt-BLImages` category.

## Nodes

### Batch Image Loader

Class ID:

```text
ComfyUI_xmt_BLImages
```

This is the main image batch node.

Inputs:

- `image_list`: Hidden image filename list managed by the frontend UI.
- `max_images`: Limits how many images are loaded. Use `0` for no limit.
- `mode`: `batch` or `single`.
- `index`: Selects the image when `mode` is `single`.
- `append`: Dedicated external upload input. Connect the External Image Upload node here.

Outputs:

- `images`: ComfyUI `IMAGE` output.
- `filenames`: Newline-separated image filenames.

Frontend controls:

- `Re-upload`: Replaces the current image list.
- `Add Images`: Adds more images to the current list.
- `Upload Folder`: Replaces the current list with images from a selected folder.
- `Run Sequentially`: Queues one workflow run per image.
- `Run First`: Runs only the first image.
- `Clear`: Clears the image list.

### External Image Upload

Class ID:

```text
ComfyUI_xmt_ExternalImageUpload
```

This node is designed for web app wrappers and ComfyUI frontend compatibility.

It uses the same native upload declaration pattern as ComfyUI's built-in Load Image node:

```python
("image": (sorted(files), {"image_upload": True}))
```

Output:

- `append`: Dedicated `XMT_BLIMAGE_APPEND` output.

How to use:

1. Add an External Image Upload node.
2. Connect its `append` output to the Batch Image Loader `append` input.
3. Upload or select an image in the External Image Upload node.
4. The selected image is passed to the Batch Image Loader through the `append` connection.

In the standard ComfyUI canvas, the frontend extension also appends the uploaded filename to the main loader preview list when possible.

In a web wrapper, this node should render as a native image upload field because it uses ComfyUI's standard `image_upload` input metadata.

### Node Select Switch

Class ID:

```text
ComfyUI_xmt_NodeSelectSwitch
```

A compact helper node for controlling the Batch Image Loader.

Actions:

- `Re-upload`
- `Add Images`
- `Upload Folder`
- `Run Sequentially`
- `Run First`
- `Clear`

Connect its `index` output to the Batch Image Loader `index` input when using it as an action controller.

## Web Wrapper Notes

For web app integration, prefer the External Image Upload node for user-facing uploads.

The Batch Image Loader custom DOM UI works in the ComfyUI canvas, but external web wrappers may not render custom `addDOMWidget` content. The External Image Upload node avoids this issue by using ComfyUI's native `image_upload` input metadata.

Recommended web-wrapper flow:

1. Render the workflow parameters from ComfyUI metadata.
2. Let the user upload an image through `ComfyUI_xmt_ExternalImageUpload.image`.
3. Connect `ComfyUI_xmt_ExternalImageUpload.append` to `ComfyUI_xmt_BLImages.append`.
4. Queue the workflow.

For multi-image uploads in a custom web app, upload each file through ComfyUI's `/upload/image` endpoint and write the returned filenames into the Batch Image Loader `image_list`, or create multiple External Image Upload nodes depending on your wrapper design.

## Development Notes

- Frontend code: `web/batch_load_images.js`
- Backend node definitions: `batch_load_images.py`
- Node registration: `__init__.py`

The external upload connection uses the custom type:

```text
XMT_BLIMAGE_APPEND
```

This keeps external upload wiring separate from the `index` input used by the switch node.

## Troubleshooting

If a node does not appear after updating:

1. Restart ComfyUI.
2. Hard-refresh the browser page.
3. Clear cached frontend assets if your ComfyUI build caches extension JavaScript.

If the web wrapper shows a text field instead of an upload field, confirm that the node input is declared with:

```python
{"image_upload": True}
```

and that the input name is exactly:

```text
image
```

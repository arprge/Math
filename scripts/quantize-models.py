#!/usr/bin/env python3
"""Shrink the OCR models without changing what they compute.

Two steps, both reversible:

1. `ppocrv6-tiny-rec.onnx` ends in a 6906-class classifier, but `dict.ts` only
   decodes the first 616 Latin/symbol classes; the multilingual tail is skipped
   at runtime anyway. Slicing that last MatMul to 617 outputs (blank + 616)
   halves the model. Argmax over the remaining classes is mathematically
   unchanged — softmax renormalises but keeps the same ordering.
2. Every Conv/MatMul weight is rewritten as per-output-channel int8 plus a
   DequantizeLinear node. The file on disk is another ~4x smaller while the
   runtime still multiplies float activations by float weights (ONNX Runtime
   keeps the weights quantised and dequantises them per run).

Together: 6.24 MB -> 1.19 MB. Inference is slightly *faster* than fp32 (the
smaller classifier more than pays for the dequantisation), and decoded text on
synthetic receipts is identical. Full int8 QDQ (activations too) was rejected:
it is ~40% slower on onnxruntime-web's WASM backend.

Usage:
    python3 scripts/quantize-models.py            # prune + quantise in place
    python3 scripts/quantize-models.py --check    # verify only, do not write

Requires: pip install onnx==1.23.2 numpy==2.5.4
"""

import argparse
import os
import sys

import numpy as np
import onnx
from onnx import helper, numpy_helper

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(ROOT, "src", "scan", "models")
MODELS = ["ppocrv6-tiny-det.onnx", "ppocrv6-tiny-rec.onnx"]
DEQUANT_SUFFIX = "_deq8"
# 0 is the CTC blank; classes 1..616 are the entries in `src/scan/dict.ts`.
# Keep this in sync with that file if the charset is ever extended.
KEEP_CLASSES = 617


def prune_classifier(model: onnx.ModelProto) -> int:
    """Slice the final classifier down to KEEP_CLASSES, if it is larger."""
    produced_by = {out: node for node in model.graph.node for out in node.output}
    initializers = {init.name: init for init in model.graph.initializer}

    for graph_output in model.graph.output:
        node = produced_by.get(graph_output.name)
        if node is None or node.op_type != "Softmax":
            continue

        bias = None
        current = node.input[0]
        head = None
        while current in produced_by:
            head = produced_by[current]
            if head.op_type == "Identity":
                current = head.input[0]
            elif head.op_type == "Add":
                candidate = head.input[1]
                if candidate in initializers:
                    bias = candidate
                current = head.input[0]
            else:
                break

        if head is None or head.op_type != "MatMul":
            continue
        weight_name = head.input[1]
        weight = initializers.get(weight_name)
        if weight is None:
            continue
        weight_array = numpy_helper.to_array(weight)
        classes = weight_array.shape[-1]
        if classes <= KEEP_CLASSES:
            continue

        trimmed = np.ascontiguousarray(weight_array[..., :KEEP_CLASSES])
        weight.CopyFrom(numpy_helper.from_array(trimmed, weight_name))
        if bias is not None:
            bias_array = numpy_helper.to_array(initializers[bias])[..., :KEEP_CLASSES]
            initializers[bias].CopyFrom(
                numpy_helper.from_array(np.ascontiguousarray(bias_array), bias)
            )

        # The declared output shape still says 6906; shape inference would
        # otherwise reject the trimmed graph.
        dims = graph_output.type.tensor_type.shape.dim
        if len(dims) and dims[-1].dim_value == classes:
            dims[-1].dim_value = KEEP_CLASSES
        model.graph.ClearField("value_info")
        return classes - KEEP_CLASSES
    return 0


def quantize_weight(weight: np.ndarray, axis: int):
    """Symmetric per-channel int8 quantisation + float32 scales."""
    weight = np.asarray(weight, dtype=np.float32)
    if axis != 0:
        weight = np.moveaxis(weight, axis, 0)
    flat = weight.reshape(weight.shape[0], -1)
    scale = np.maximum(np.abs(flat).max(axis=1) / 127.0, 1e-8).astype(np.float32)
    q = np.clip(np.rint(flat / scale[:, None]), -127, 127).astype(np.int8)
    q = q.reshape(weight.shape)
    if axis != 0:
        q = np.moveaxis(q, 0, axis)
    return q, scale


def convert(model_path: str) -> tuple[int, int]:
    model = onnx.load(model_path)
    if any(node.op_type == "DequantizeLinear" and node.output[0].endswith(DEQUANT_SUFFIX)
           for node in model.graph.node):
        return 0, 0

    pruned = prune_classifier(model)

    onnx_opset = next((o.version for o in model.opset_import if o.domain in ("", "ai.onnx")), 0)
    if onnx_opset < 13:
        # Per-axis DequantizeLinear (axis attribute) needs opset 13. The
        # version converter only touches shape/semantics-preserving details here.
        model = onnx.version_converter.convert_version(model, 13)
        onnx_opset = 13

    initializers = {init.name: init for init in model.graph.initializer}
    nodes, added, replaced = [], [], set()

    for node in model.graph.node:
        if node.op_type not in ("Conv", "MatMul") or len(node.input) < 2:
            nodes.append(node)
            continue

        name = node.input[1]
        init = initializers.get(name)
        if init is None or name in replaced:
            nodes.append(node)
            continue

        weight = numpy_helper.to_array(init)
        if weight.ndim < 2 or weight.dtype != np.float32:
            nodes.append(node)
            continue

        # Conv weights are [M, C, kH, kW]; MatMul weights are [K, N].
        axis = 0 if node.op_type == "Conv" else (1 if weight.ndim == 2 else 0)
        q, scale = quantize_weight(weight, axis)
        q_name, s_name, dq_name = f"{name}_q8", f"{name}_scale8", f"{name}{DEQUANT_SUFFIX}"

        added.append(numpy_helper.from_array(q, q_name))
        added.append(numpy_helper.from_array(scale, s_name))
        # Place dequantisers before their consumers; ONNX requires a
        # topologically sorted graph.
        nodes.append(helper.make_node(
            "DequantizeLinear", [q_name, s_name], [dq_name], name=f"{name}_dequant", axis=axis
        ))
        node.input[1] = dq_name
        nodes.append(node)
        replaced.add(name)

    kept = [init for init in model.graph.initializer if init.name not in replaced]
    del model.graph.initializer[:]
    model.graph.initializer.extend(kept + added)
    del model.graph.node[:]
    model.graph.node.extend(nodes)
    model.graph.ClearField("value_info")

    onnx.checker.check_model(model, full_check=False)

    tmp = f"{model_path}.tmp"
    onnx.save(model, tmp)
    os.replace(tmp, model_path)
    return len(replaced), pruned


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify, never write")
    args = parser.parse_args()

    failed = False
    for name in MODELS:
        path = os.path.join(MODEL_DIR, name)
        if not os.path.isfile(path):
            print(f"missing  {name} — run: npm run fetch-models", file=sys.stderr)
            failed = True
            continue

        model = onnx.load(path, load_external_data=False)
        done = any(
            node.op_type == "DequantizeLinear" and node.output[0].endswith(DEQUANT_SUFFIX)
            for node in model.graph.node
        )
        if done:
            print(f"ok       {name} ({os.path.getsize(path) / 1e6:.2f} MB)")
            continue
        if args.check:
            print(f"float    {name} — run: npm run quantize-models", file=sys.stderr)
            failed = True
            continue

        weights, pruned = convert(path)
        detail = f"{weights} weights" + (f", {pruned} classes pruned" if pruned else "")
        print(f"shrunk   {name} ({os.path.getsize(path) / 1e6:.2f} MB, {detail})")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

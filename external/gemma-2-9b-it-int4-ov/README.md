---
license: gemma
license_link: https://choosealicense.com/licenses/gemma/
base_model: google/gemma-2-9b-it
base_model_relation: quantized
---
# gemma-2-9b-it-int4-ov
* Model creator: [google](https://huggingface.co/google)
 * Original model: [gemma-2-9b-it](https://huggingface.co/google/gemma-2-9b-it)

## Description
This is [gemma-2-9b-it](https://huggingface.co/google/gemma-2-9b-it) model converted to the [OpenVINO™ IR](https://docs.openvino.ai/2024/documentation/openvino-ir-format.html) (Intermediate Representation) format with weights compressed to INT4 by [NNCF](https://github.com/openvinotoolkit/nncf).

## Quantization Parameters

Weight compression was performed using `nncf.compress_weights` with the following parameters:

* mode: **int4_asym**
* ratio: **1**
* group_size: **128**

For more information on quantization, check the [OpenVINO model optimization guide](https://docs.openvino.ai/2024/openvino-workflow/model-optimization-guide/weight-compression.html).


## Compatibility

The provided OpenVINO™ IR model is compatible with:

* OpenVINO version 2024.5.0 and higher
* Optimum Intel 1.21.0 and higher

## Running Model Inference with [Optimum Intel](https://huggingface.co/docs/optimum/intel/index)


1. Install packages required for using [Optimum Intel](https://huggingface.co/docs/optimum/intel/index) integration with the OpenVINO backend:

```
pip install optimum[openvino]
```

2. Run model inference:

```
from transformers import AutoTokenizer
from optimum.intel.openvino import OVModelForCausalLM

model_id = "OpenVINO/gemma-2-9b-it-int4-ov"
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = OVModelForCausalLM.from_pretrained(model_id)

inputs = tokenizer("What is OpenVINO?", return_tensors="pt")

outputs = model.generate(**inputs, max_length=200)
text = tokenizer.batch_decode(outputs)[0]
print(text)
```

For more examples and possible optimizations, refer to the [OpenVINO Large Language Model Inference Guide](https://docs.openvino.ai/2024/learn-openvino/llm_inference_guide.html).

## Running Model Inference with [OpenVINO GenAI](https://github.com/openvinotoolkit/openvino.genai)

1. Install packages required for using OpenVINO GenAI.
```
pip install openvino-genai huggingface_hub
```

2. Download model from HuggingFace Hub
   
```
import huggingface_hub as hf_hub

model_id = "OpenVINO/gemma-2-9b-it-int4-ov"
model_path = "gemma-2-9b-it-int4-ov"

hf_hub.snapshot_download(model_id, local_dir=model_path)

```

3. Run model inference:

```
import openvino_genai as ov_genai

device = "CPU"
pipe = ov_genai.LLMPipeline(model_path, device)
print(pipe.generate("What is OpenVINO?", max_length=200))
```

More GenAI usage examples can be found in OpenVINO GenAI library [docs](https://github.com/openvinotoolkit/openvino.genai/blob/master/src/README.md) and [samples](https://github.com/openvinotoolkit/openvino.genai?tab=readme-ov-file#openvino-genai-samples)

## Limitations

Check the original model card for [original model card](https://huggingface.co/google/gemma-2-9b-it) for limitations.

## Legal information

The original model is distributed under [gemma](https://choosealicense.com/licenses/gemma/) license. More details can be found in [original model card](https://huggingface.co/google/gemma-2-9b-it).

## Disclaimer

Intel is committed to respecting human rights and avoiding causing or contributing to adverse impacts on human rights. See [Intel’s Global Human Rights Principles](https://www.intel.com/content/dam/www/central-libraries/us/en/documents/policy-human-rights.pdf). Intel’s products and software are intended only to be used in applications that do not cause or contribute to adverse impacts on human rights.

import argparse
from diffusers import StableDiffusionPipeline, AutoencoderKL    

from pathlib import Path
import json

parser = argparse.ArgumentParser("SD")
parser.add_argument("--prompt", help="prompt given to stable diffusion", type=str)
parser.add_argument("--device", help="device to run on", type=str, default="AUTO")
parser.add_argument("--model_id", help="model id to use", type=str, default="sdxs-512-dreamshaper")
parser.add_argument("--model_dir", help="model directory to use", type=str, default="AiResources")
parser.add_argument("--output-dir", help="output path to save results", type=str, default="assets/images")
parser.add_argument("--songId", help="song id to use", type=str)
parser.add_argument("--allSongs", help="use all songs", action="store_true")
parser.add_argument("-e", "--electron", help="run in electron mode", action="store_true")
args = parser.parse_args()

DEVICE = args.device
MODEL_ID = args.model_id
MODEL_DIR = args.model_dir + "/" + MODEL_ID
if args.electron:
    MODEL_DIR = "resources/"+ MODEL_DIR
print(f"DEVICE: {DEVICE}")
print(f"MODEL_ID: {MODEL_ID}")
print(f"MODEL_DIR: {MODEL_DIR}")

jsonFields = ["background_prompts", "object_prompts"]


pipe = StableDiffusionPipeline.from_pretrained(MODEL_DIR) 
print("Finished AI Setup")

sample_text = (
    "cyberpunk cityscape like Tokyo New York  with tall buildings at dusk golden hour cinematic lighting, epic composition. "
    "A golden daylight, hyper-realistic environment. "
    "Hyper and intricate detail, photo-realistic. "
    "Cinematic and volumetric light. "
    "Epic concept art. "
    "Octane render and Unreal Engine, trending on artstation"
)

# SONG MODE
if args.songId:
    path = Path("assets","SongData", args.songId+".json")
    imagesDir = Path(args.output_dir, args.songId)
    if args.electron:
        path = Path("resources", "assets", "SongData", args.songId+".json")
        imagesDir = Path("resources", "assets", "images", args.songId)  
    if not path.exists():
        print("Song not found")
    if not imagesDir.exists():
        imagesDir.mkdir()
    with open(path) as f:
        data = json.load(f)
    for field in jsonFields:
        objectList = data[field]
        for (i, obj) in enumerate(objectList):
            sample_text = obj
            result = pipe(sample_text, num_inference_steps=1, guidance_scale=0)
            image = result.images[0]
            image.save(imagesDir / f"{field}_{i}.png")
            print(f"Finished {field}_{i}")
    print("Finished Stable Diffusion")


# run on all songs
elif args.allSongs:
    songDir = Path("assets", "SongData")
    for path in songDir.iterdir():
        if path.suffix == ".json":
            imagesDir = Path(args.output_dir, path.stem)
            if not imagesDir.exists():
                imagesDir.mkdir()
            with open(path) as f:
                data = json.load(f)
            for field in jsonFields:
                objectList = data[field]
                for (i, obj) in enumerate(objectList):
                    sample_text = obj
                    result = pipe(sample_text, num_inference_steps=1, guidance_scale=0)
                    image = result.images[0]
                    image.save(imagesDir / f"{field}_{i}.png")
                    print(f"Finished {field}_{i}")
            print(f"Finished {path.suffix}")
    print("Finished Stable Diffusion")

else:
    if args.prompt:
        sample_text = args.prompt

    result = pipe(sample_text, num_inference_steps=1, guidance_scale=0)

    image = result.images[0]

    image.save("result.png")

<img src="https://github.com/user-attachments/assets/80050446-233a-4f93-bd3e-787dcfb152b4" width="50%" />

<img src="https://github.com/user-attachments/assets/20b32e75-1976-493c-b55f-8d566c552cf5" width="100%" />


<br>


## Project Overview
This project provides an affordable, AI-powered sensory room designed to support autistic children by creating immersive, adaptive environments tailored to their emotional needs. Using accessible hardware like Intel-based computers, Philips Hue lights, and motion-tracking technology, the room dynamically responds to speech and gestures, adjusting visuals, sounds, and lighting. By enabling intuitive interactions and emotional regulation through sensory stimuli, this solution offers an effective and scalable approach to improving communication skills, emotional resilience, and overall comfort for children with autism.

### Particle Visualiser

https://github.com/user-attachments/assets/98da8b35-53a8-44fd-baab-022650dd28d2

The Particle Visualiser creates dynamic, responsive and interactive particle systems tailored to each song's theme and mood. Using a physics-based engine, particles exhibit realistic behaviors including gravity, bounce effects, air resistance, and custom lifespans.

Key features include:

- **Customizable Particles**: Each particle type has adjustable physical properties (weight, gravity, bounce, air resistance, lifespan) that can be modified through an intuitive settings interface.
  
- **Custom Imagery**: Upload and manage multiple images for each particle type, allowing for rich visual diversity.
  
- **Interactive Experience**: Particles respond to user interaction - they can be generated with clicks and move according to the music's rhythm and intensity.
  
- **Song-Specific Selection**: Each song can have multiple particle types assigned to it, with a simple interface to add or remove particles based on the desired visual effect and mood.
  
- **Create Custom Particles**: Users can create their own particle types with custom names and configure all their properties to achieve unique visual effects.
  
- **Glow Effects**: Toggle glow effects for particles to enhance visual appeal during moments of musical intensity.

The particle system is designed to be highly performant while providing soothing yet engaging visual representations of sound that can be fully customized to support different sensory preferences and needs.

### Shader Visualiser

![ezgif-7490fcba69ce7e](https://github.com/user-attachments/assets/ae00afd0-27ca-423f-93c2-6d845fa9484a)

The shader visual allows you to interact with the particles simply by moving your mouse (or hand gestures with motion input, COMING SOON!). The particles read from a specific texture and will make move ments according to the music at the same time.

You can also set colour, background and particle shape yourself from the settings in each song.

### Hue Integration
Our integration with the Philips Hue Entertainment API provides an immersive experience, synchronising room lighting in real-time with on-screen visuals and audio. Lights dynamically respond to music beats, vocals, and directional cues—for example, on-screen activity occurring on the right side will trigger more intense lighting effects on the corresponding side of the room, creating an engaging and interactive environment.

## Installation 

### Recommended Installation
Download our zip file from our release on github. The zip file contains `SuperHappySpace.exe`, which is the main executable for our product.

### Github installation

1. Clone the repository
TODO: Change to closed repo
```shell
git clone git@github.com:hugomarfani/AudioVisuliserV3.git
```

2. Install dependencies

#### Node.js dependencies
```shell
npm install
```

#### AI dependencies

Go to the resources folder from the root directory. This will automatically contain the executables required.
```shell
cd resources
```

For default settings (in accordance with our product created for Super Happy Space), create a directory named `AiResources` and download the models in there either manually or using git lfs
```shell
mkdir AiResources
cd AiResources
# download and move all 3 models from huggingface here
```
If using git to install the models:
1. download Git LFS following the instructions [here](https://docs.github.com/en/repositories/working-with-files/managing-large-files/installing-git-large-file-storage)
2. Run the following commands
```shell
git lfs install
git clone https://huggingface.co/OpenVINO/distil-whisper-large-v3-int8-ov
git clone https://huggingface.co/OpenVINO/gemma-2-9b-it-int4-ov
git clone https://huggingface.co/IDKiro/sdxs-512-dreamshaper
```

Otherwise, download the models from the following links:
1. [distil-whisper-large-v3-int8-ov](https://huggingface.co/OpenVINO/distil-whisper-large-v3-int8-ov)
2. [gemma-2-9b-it-int4-ov](https://huggingface.co/OpenVINO/gemma-2-9b-it-int4-ov)
3. [sdxs-512-dreamshaper](https://huggingface.co/IDKiro/sdxs-512-dreamshaper)

And place them in the `AiResources` directory.

Finally, download the openvino package from the zip file [here](https://storage.openvinotoolkit.org/repositories/openvino_genai/packages/2025.0/windows).
Unzip the file and rename it to `openvino_2025` and place it in the `AiResources` directory.

## Compiling from Source

### OpenVINO C++ 

The C++ implementation using OpenVINO and OpenVINO GenAI library has 2 ways to compile, using a dynamic library format or a static library format. The dynamic library format is recommended.

#### Dynamic Build 

Download the openvino package from the zip file [here](https://storage.openvinotoolkit.org/repositories/openvino_genai/packages/2025.0/windows).
Unzip the file and rename it to `openvino_2025` and place it in the `AiResources` directory.

Run the setup script from the root directory
```shell
./resources/AiResources/openvino_2025/setupvars.bat
# or setupvars.ps1 for powershell systems
```

From the root directory, move to the external directory and create a build directory
```shell
cd external
mkdir build
``` 

Run the following commands to build the project
```shell
cmake -S ./project -B ./build
cmake --build ./build --config Release
```

The executable will be in under `./external/build/Release/cppVer.exe`. 
Move this file to `./resources` to be used by the main application.


#### Static Build 

It is possible to create static build of openvino from the source files. However, this is not a recommended method as it is more complex and the nuumber of errors the user encounters heavily depends on their setup.

First clone the necessary repositories and submodules
```shell
git clone https://github.com/openvinotoolkit/openvino.git
git clone https://github.com/openvinotoolkit/openvino.genai.git
git submodule update --init --recursive
mkdir build & cd build
```

Run the following commands to build the project, assuming you have Visual Studio 2019 installed, choose the correct generator for your system.
```shell
cmake -G "Visual Studio 16 2019" -DBUILD_SHARED_LIBS=OFF -DCMAKE_BUILD_TYPE=Release -DCMAKE_TOOLCHAIN_FILE={path to openvino}/cmake/toolchains/mt.runtime.win32.toolchain.cmake -DOPENVINO_EXTRA_MODULES={path to openvion.genai} ../openvino 
```

Compile the cmake project
```shell
cmake --build . --target openvino --config Release 
```

Install the project onto your machine
```shell
cmake -DCMAKE_INSTALL_PREFIX=C:\Users\billy\Documents\coding\temp\install -P .\build\cmake_install.cmake 
```

After these steps, the openvino library will be installed on your machine and it should be possible to link it to the C++ project using cmake.


### Diffusers Python Pyinstaller 
Go to the external directory and run the following command:
```shell
cd external
pip install requirements.txt
pyinstaller –F SD.py 
```
The build was done with python version 3.10.0. The executable will be in the `dist` folder. Move the executable to the resources folder to be used by the main application.


## Starting Development

Start the app in the `dev` environment:

```bash
npm start
```

## Packaging for Production

To package apps for the local platform:

```bash
npm run package
```

The folder with the executable will be under `./release/build` under the name `win-unpacked`.

## Coders
- [Hugo Marfani](https://github.com/hugomarfani)
- [Horesh Lopian](https://github.com/HoreshLupi)
- [Kiminao Usami](https://github.com/NaokiRe)
- [Aiden Cheng](https://github.com/AidCheng)

## Dependencies
This repository was forked off [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate).

### Maintainers for Electron Boilerplate

- [Amila Welihinda](https://github.com/amilajack)
- [John Tran](https://github.com/jooohhn)
- [C. T. Lin](https://github.com/chentsulin)
- [Jhen-Jie Hong](https://github.com/jhen0409)

<!-- ### License

MIT © [Electron React Boilerplate](https://github.com/electron-react-boilerplate)

[github-actions-status]: https://github.com/electron-react-boilerplate/electron-react-boilerplate/workflows/Test/badge.svg
[github-actions-url]: https://github.com/electron-react-boilerplate/electron-react-boilerplate/actions
[github-tag-image]: https://img.shields.io/github/tag/electron-react-boilerplate/electron-react-boilerplate.svg?label=version
[github-tag-url]: https://github.com/electron-react-boilerplate/electron-react-boilerplate/releases/latest
[stackoverflow-img]: https://img.shields.io/badge/stackoverflow-electron_react_boilerplate-blue.svg
[stackoverflow-url]: https://stackoverflow.com/questions/tagged/electron-react-boilerplate -->

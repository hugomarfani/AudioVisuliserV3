<img src="https://github.com/user-attachments/assets/80050446-233a-4f93-bd3e-787dcfb152b4" width="50%" />

<img src="https://github.com/user-attachments/assets/20b32e75-1976-493c-b55f-8d566c552cf5" width="100%" />


<br>


## Project Overview
This project provides an affordable, AI-powered sensory room designed to support autistic children by creating immersive, adaptive environments tailored to their emotional needs. Using accessible hardware like Intel-based computers, Philips Hue lights, and motion-tracking technology, the room dynamically responds to speech and gestures, adjusting visuals, sounds, and lighting. By enabling intuitive interactions and emotional regulation through sensory stimuli, this solution offers an effective and scalable approach to improving communication skills, emotional resilience, and overall comfort for children with autism.

### Particle Visualiser

![Particles-ezgif com-video-to-gif-converter](https://github.com/user-attachments/assets/9fec7dc5-f390-47bc-8335-eced2294a0fa)

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

## Install

Clone the repo and install dependencies:

```bash
git clone --depth 1 --branch main https://github.com/electron-react-boilerplate/electron-react-boilerplate.git your-project-name
cd your-project-name
npm install

cd release/app
npm install sqlite3 sequelize



npm install p5
npm i --save-dev @types/p5
npm install yt-dlp-exec fluent-ffmpeg

```

To run the LLM command from the app:

1. Download the gemma-2-9b-it-int4-ov from the huggingface model hub [here](https://huggingface.co/OpenVINO/gemma-2-9b-it-int4-ov)
2. Place the model directory in the `AiResources` directory with the name "gemma-2-9b-it-int4-ov"
3. Download the openvino installer zip file from [here](https://storage.openvinotoolkit.org/repositories/openvino_genai/packages/2025.0/windows)
4. Extract the zip file and rename the directory to `openvino_2025` and place it in the `AiResources` directory
5. Run the app as usual and the LLM should be available in the dropdown from File -> Run Gemma Test

To compile the exe file for gemma:

1. Run the following command in the terminal

```bash
AiResources/openvino_2025/setupvars.ps1
cd external
cmake -G "Visual Studio 16 2019" -A x64 -DCMAKE_BUILD_TYPE=Release -S ./project -B ./build
cmake --build ./build --config Release
```

2. The exe file will be located in the `external/build/Release` directory

3. Place the exe file in the root directory of the app

**Having issues installing? See our [debugging guide](https://github.com/electron-react-boilerplate/electron-react-boilerplate/issues/400)**

## Starting Development

Start the app in the `dev` environment:

```bash
npm start
```

Then in a seperate terminal

```bash
npm run server
```

## Packaging for Production

To package apps for the local platform:

```bash
npm run package
```

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

### License

MIT © [Electron React Boilerplate](https://github.com/electron-react-boilerplate)

[github-actions-status]: https://github.com/electron-react-boilerplate/electron-react-boilerplate/workflows/Test/badge.svg
[github-actions-url]: https://github.com/electron-react-boilerplate/electron-react-boilerplate/actions
[github-tag-image]: https://img.shields.io/github/tag/electron-react-boilerplate/electron-react-boilerplate.svg?label=version
[github-tag-url]: https://github.com/electron-react-boilerplate/electron-react-boilerplate/releases/latest
[stackoverflow-img]: https://img.shields.io/badge/stackoverflow-electron_react_boilerplate-blue.svg
[stackoverflow-url]: https://stackoverflow.com/questions/tagged/electron-react-boilerplate

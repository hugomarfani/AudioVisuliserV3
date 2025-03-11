<img src=".erb/img/erb-banner.svg" width="100%" />

<br>

<p>
  Electron React Boilerplate uses <a href="https://electron.atom.io/">Electron</a>, <a href="https://facebook.github.io/react/">React</a>, <a href="https://github.com/reactjs/react-router">React Router</a>, <a href="https://webpack.js.org/">Webpack</a> and <a href="https://www.npmjs.com/package/react-refresh">React Fast Refresh</a>.
</p>

<br>

<div align="center">

[![Build Status][github-actions-status]][github-actions-url]
[![Github Tag][github-tag-image]][github-tag-url]
[![Discord](https://badgen.net/badge/icon/discord?icon=discord&label)](https://discord.gg/Fjy3vfgy5q)

[![OpenCollective](https://opencollective.com/electron-react-boilerplate-594/backers/badge.svg)](#backers)
[![OpenCollective](https://opencollective.com/electron-react-boilerplate-594/sponsors/badge.svg)](#sponsors)
[![StackOverflow][stackoverflow-img]][stackoverflow-url]

</div>

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

## Packaging for Production

To package apps for the local platform:

```bash
npm run package
```

## Dependencies
This repository was forked off [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate).

## Maintainers

- [Amila Welihinda](https://github.com/amilajack)
- [John Tran](https://github.com/jooohhn)
- [C. T. Lin](https://github.com/chentsulin)
- [Jhen-Jie Hong](https://github.com/jhen0409)

## License

MIT © [Electron React Boilerplate](https://github.com/electron-react-boilerplate)

[github-actions-status]: https://github.com/electron-react-boilerplate/electron-react-boilerplate/workflows/Test/badge.svg
[github-actions-url]: https://github.com/electron-react-boilerplate/electron-react-boilerplate/actions
[github-tag-image]: https://img.shields.io/github/tag/electron-react-boilerplate/electron-react-boilerplate.svg?label=version
[github-tag-url]: https://github.com/electron-react-boilerplate/electron-react-boilerplate/releases/latest
[stackoverflow-img]: https://img.shields.io/badge/stackoverflow-electron_react_boilerplate-blue.svg
[stackoverflow-url]: https://stackoverflow.com/questions/tagged/electron-react-boilerplate

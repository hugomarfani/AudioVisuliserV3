#include <algorithm>
#include <boost/program_options.hpp>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <nlohmann/json.hpp>
#include <openvino/genai/llm_pipeline.hpp>
#include <openvino/genai/text2image_pipeline.hpp>
#include <openvino/genai/whisper_pipeline.hpp>
#include <openvino/openvino.hpp>
#include <ranges>
#include <regex>
#include <stdexcept>
#include <string>
#include <tuple>
#include <unordered_map>
#include <vector>

#include "audio_utils.hpp"
#include "imwrite.hpp"

std::ofstream logFile;

using json = nlohmann::json;
namespace po = boost::program_options;

// ----------------- Prompts -----------------
std::string colourExtractionPrompt =
    "Analyze the lyrics of the song provided and extract 5 unique,"
    "unusual colors (avoid common colors like red, green, or blue) that are "
    "explicitly mentioned or strongly implied."
    "Represent each color in #RRGGBB hexadecimal format. Ensure the output is "
    "in the following exact format"
    "for easy extraction using regex:"
    "Color 1: #RRGGBB"
    "Color 2: #RRGGBB"
    "Color 3: #RRGGBB"
    "Color 4: #RRGGBB"
    "Color 5: #RRGGBB"
    "If a color is not explicitly named, infer it from vivid imagery or "
    "metaphors in the lyrics."
    "Provide the formatted output, followed by a brief explanation of why each "
    "color was chosen, in the following format:"
    "Color 1 reason: Explanation"
    "Color 2 reason: Explanation"
    "Color 3 reason: Explanation"
    "Color 4 reason: Explanation"
    "Color 5 reason: Explanation";

std::string particleSelectionPrompt =
    "Analyze the lyrics of the song provided and choose 1 particle effect from "
    "the following list,"
    "that best fits the mood and theme of the song. Output the name of the "
    "selected particle effect and no other word. Here is the list of particle "
    "effects:";

std::string lyricsPrompt = "These are the lyrics for";

std::string objectExtractionPrompt =
    "Analyze the lyrics of the song provided and extract 3 unique, unusual "
    "objects that are explicitly mentioned or strongly implied."
    "Give the output in the following exact format for easy extraction using "
    "regex:"
    "Object 1: $Object name$"
    "Object 2: $Object name$"
    "Object 3: $Object name$";

std::string backgroundExtractionPrompt =
    "Analyze the lyrics of the song provided and extract 3 unique, unusual "
    "backgrounds that are explicitly mentioned or strongly implied."
    "Give the output in the following exact format for easy extraction using "
    "regex:"
    "Background 1: $Background name$"
    "Background 2: $Background name$"
    "Background 3: $Background name$";

std::string imageSetup =
    "Create a prompt to be passed to a text to image generation model to "
    "generate an image of ";

std::string imageSettings =
    ". The prompt should include the following settings:";

std::string objectSettings =
    "colour: black object with white background"
    "prompt: ";

std::string backgroundSettings =
    "colour: colourful background, "
    "suitable for children and family"
    "prompt: ";

// ----------------- paths -----------------
std::filesystem::path currentDirectory = std::filesystem::current_path();
std::string modelPath =
    (currentDirectory / "AiResources" / "gemma-2-9b-it-int4-ov").string();
std::string stableDiffusionModelPath =
    (currentDirectory / "AiResources" / "stable-diffusion-v1-5-int8-ov")
        .string();
// using whisper path again after this so needs to be filesystem::path
std::filesystem::path whisperModelPath =
    (currentDirectory / "AiResources" / "distil-whisper-large-v3-int8-ov");
std::string outputFilePath =
    (currentDirectory / "AiResources" / "./output.json").string();
std::string particleListFilePath =
    (currentDirectory / "AiResources" / "particleList.json").string();
std::string logPath = (currentDirectory / "AiResources" / "./log.txt").string();
std::filesystem::path lyricsDirPath =
    (currentDirectory / "AiResources" / "lyrics");
std::filesystem::path wavDirPath = (currentDirectory / "AiResources" / "wav");

// ----------------- Log Functions -----------------
void redirectConsoleOutput() {
  logFile.open(logPath, std::ofstream::out | std::ofstream::trunc);
  logFile.close();
  logFile.open(logPath, std::ios::out | std::ios::app);
  if (!logFile) {
    std::cerr << "Error Unable to open log file!" << std::endl;
    exit(EXIT_FAILURE);
  }
  std::cout.rdbuf(logFile.rdbuf());
  std::cerr.rdbuf(logFile.rdbuf());
}

void cleanup() {
  if (logFile.is_open()) {
    logFile.flush();
    logFile.close();
  }
}

// ----------------- Helper Functions -----------------

/**
 * @brief Retrieves the model device to be used for computation.
 *
 * This function queries the available devices from the OpenVINO core and
 * selects an appropriate device for computation. It prioritizes GPU devices if
 * available, otherwise, it selects the first available device.
 *
 * @return std::string The name of the selected device.
 *
 * @throws std::runtime_error If no devices are available.
 */
std::string getModelDevice() {
  ov::Core core;

  std::vector<std::string> availableDevices = core.get_available_devices();
  // print available devices
  // for (const auto &device : availableDevices)
  // {
  //     std::cout << "Available device: " << device << std::endl;
  // }
  std::ranges::copy(availableDevices,
                    std::ostream_iterator<std::string>(std::cout, ", "));

  // raise error if no devices are available
  if (availableDevices.empty()) {
    throw std::runtime_error("No devices available");
  }

  for (const auto &device : availableDevices) {
    // use GPU if available
    if (device.find("GPU") != std::string::npos) {
      std::cout << "Selected device: " << device << std::endl;
      return device;
    }
  }
  std::cout << "Selected device: " << availableDevices[0] << std::endl;
  return availableDevices[0];
}

/**
 * @brief Retrieves the lyrics of a given song from a text file.
 *
 * This function reads the lyrics of the specified song from a text file located
 * in the lyrics directory. The file should be named as the song name with a
 * .txt extension.
 *
 * @param songName The name of the song whose lyrics are to be retrieved.
 * @return A string containing the lyrics of the song.
 * @throws std::runtime_error If the lyrics file cannot be opened.
 */
std::string getLyrics(std::string songName) {
  // read in lyrics from lyrics folder under song.txt
  std::string lyrics = "";
  std::string line;
  std::ifstream lyricsFile;
  std::string lyricsFilePath = (lyricsDirPath / (songName + ".txt")).string();
  std::cout << "Lyrics File Path: " << lyricsFilePath << std::endl;
  lyricsFile.open(lyricsFilePath);
  if (lyricsFile.is_open()) {
    while (getline(lyricsFile, line)) {
      lyrics += line + "\n";
    }
    lyricsFile.close();
  } else {
    throw std::runtime_error("Unable to open file");
  }

  return lyrics;
}

auto getParticleEffectFromJson(std::string filePath) {
  // read in particle effects from json file
  std::ifstream inputFile(filePath);
  if (!inputFile.is_open()) {
    throw std::runtime_error("Unable to open file");
  }
  json jsonData;
  inputFile >> jsonData;
  inputFile.close();

  if (jsonData.contains("particles") && jsonData["particles"].is_array()) {
    return jsonData["particles"];
  } else {
    throw std::runtime_error("Invalid json format");
  }
}

std::vector<std::string> getOptionsFromLlmOutput(std::string llmOutput) {
  // regex to match all options, sandwiched by
  std::regex optionsRegex(": \\$(.*?)\\$");
  // create iterator to iterate through matches
  std::sregex_iterator next(llmOutput.begin(), llmOutput.end(), optionsRegex);
  std::sregex_iterator end;
  std::vector<std::string> options;
  // iterate through matches and store in vector
  while (next != end) {
    std::smatch match = *next;
    std::string unstrippedOption = match.str();
    // strip the option of the leading and trailing characters (starts with ":
    // $" and ends with "$") make sure length is at least 4 to avoid out of
    // bounds error
    if (unstrippedOption.size() < 4) {
      throw std::runtime_error("Invalid option format");
    }
    std::string option =
        unstrippedOption.substr(3, unstrippedOption.size() - 4);
    options.push_back(option);
    next++;
  }
  return options;
}

// ----------------- Enums -----------------

enum LLMOutputType {
  COLOURS,
  COLOURS_REASON,
  PARTICLES,
  OBJECTS,
  BACKGROUNDS,
  OBJECT_PROMPTS,
  BACKGROUND_PROMPTS
};

const std::unordered_map<LLMOutputType, std::string> outputTypeMap = {
    {COLOURS, "colours"},
    {COLOURS_REASON, "colours_reason"},
    {PARTICLES, "particles"},
    {OBJECTS, "objects"},
    {BACKGROUNDS, "backgrounds"},
    {OBJECT_PROMPTS, "object_prompts"},
    {BACKGROUND_PROMPTS, "background_prompts"}};

const std::unordered_map<std::string, LLMOutputType> outputTypeMapReverse = {
    {"colours", COLOURS},
    {"colours_reason", COLOURS_REASON},
    {"particles", PARTICLES},
    {"objects", OBJECTS},
    {"backgrounds", BACKGROUNDS},
    {"object_prompts", OBJECT_PROMPTS},
    {"background_prompts", BACKGROUND_PROMPTS}};

// ----------------- LLM Class -----------------
class LLM {
 private:
  const std::string device;
  ov::genai::LLMPipeline pipe;
  const std::string songName;
  const std::string lyrics;
  const bool debug;
  std::string lyricsSetup;

  std::unordered_map<LLMOutputType, std::vector<std::string>> outputMap;

  std::string generate(std::string prompt, int max_new_tokens) {
    return pipe.generate(prompt, ov::genai::max_new_tokens(max_new_tokens));
  }

  void retrieveCurrentOutput() {
    json j;
    // read existing json data from file if it exists
    std::ifstream inputFile(outputFilePath);
    if (inputFile.is_open()) {
      inputFile >> j;
      inputFile.close();
    } else {
      j = json();
    }
    // store existing data in outputMap
    for (const auto &output : j.items()) {
      LLMOutputType outputType = outputTypeMapReverse.at(output.key());
      outputMap[outputType] = output.value();
    }
  }

 public:
  LLM(std::string llmModelPath, std::string songName, bool debug)
      : device(getModelDevice()),
        pipe(llmModelPath, device),
        songName(songName),
        lyrics(getLyrics(songName)),
        debug(debug) {
    std::cout << "LLM Pipeline initialised with the following settings: "
              << std::endl;
    std::cout << "Model Path: " << llmModelPath << std::endl;
    std::cout << "Device: " << device << std::endl;
    std::cout << "Song Name: " << songName << std::endl;
    lyricsSetup = lyricsPrompt + " " + songName + "\n" + lyrics;
    outputMap = std::unordered_map<LLMOutputType, std::vector<std::string>>();
    retrieveCurrentOutput();
  }

  void extractColours() {
    std ::cout << "Extracting colours from lyrics" << std::endl;
    std::string colourPrompt = lyricsSetup + colourExtractionPrompt;
    std::string colourOutput = generate(colourPrompt, 500);

    std::vector<std::string> colours;
    // regex to match hex colours
    std::regex hexColour("#[0-9a-fA-F]{6}");
    // create iterator to iterate through matches
    std::sregex_iterator next(colourOutput.begin(), colourOutput.end(),
                              hexColour);
    std::sregex_iterator end;
    // iterate through matches and store in json object
    while (next != end) {
      std::smatch match = *next;
      colours.push_back(match.str());
      next++;
    }

    outputMap[COLOURS] = colours;
    outputMap[COLOURS_REASON] = {colourOutput};

    if (debug) {
      std::cout << "Colours extracted: " << std::endl;
      std::cout << colourOutput << std::endl;
    }
  }

  void extractParticleEffect() {
    std::cout << "Obtaining list of particle effects" << std::endl;
    std::vector<std::string> particleList =
        getParticleEffectFromJson(particleListFilePath);
    std::string particlePrompt = lyricsSetup + particleSelectionPrompt + "\n";
    for (const auto &particle : particleList) {
      particlePrompt += particle + "\n";
    }
    std::string particleOutput = generate(particlePrompt, 100);

    outputMap[PARTICLES] = getOptionsFromLlmOutput(particleOutput);
    if (debug) {
      std::cout << "Particle effect extracted: " << std::endl;
      std::cout << particleOutput << std::endl;
    }
  }

  void extractObjects() {
    std::cout << "Extracting objects from lyrics" << std::endl;
    std::string objectPrompt = lyricsSetup + objectExtractionPrompt;
    std::string objectOutput = generate(objectPrompt, 500);
    std::vector<std::string> objects = getOptionsFromLlmOutput(objectOutput);

    outputMap[OBJECTS] = objects;

    if (debug) {
      std::cout << "Objects extracted: " << std::endl;
      for (const auto &object : objects) {
        std::cout << object << std::endl;
      }
      std ::cout << "original output: " << std::endl;
      std::cout << objectOutput << std::endl;
    }
  }

  void extractBackgrounds() {
    std::cout << "Extracting backgrounds from lyrics" << std::endl;
    std::string backgroundPrompt = lyricsSetup + backgroundExtractionPrompt;
    std::string backgroundOutput = generate(backgroundPrompt, 500);
    std::vector<std::string> backgrounds =
        getOptionsFromLlmOutput(backgroundOutput);

    outputMap[BACKGROUNDS] = backgrounds;

    if (debug) {
      std::cout << "Backgrounds extracted: " << std::endl;
      for (const auto &background : backgrounds) {
        std::cout << background << std::endl;
      }
      std::cout << "original output: " << std::endl;
      std::cout << backgroundOutput << std::endl;
    }
  }

  void generateObjectPrompts() {
    std::cout << "Generating object image prompts" << std::endl;
    std::vector<std::string> objectPromptList;
    // check if objects have been extracted
    if (outputMap.find(OBJECTS) == outputMap.end()) {
      throw std::runtime_error("Objects have not been extracted");
    }
    std::vector<std::string> objects = outputMap[OBJECTS];
    for (const auto &object : objects) {
      std::string objectPromptPrompt = imageSetup + object + imageSettings;
      std::string objectPrompt = generate(objectPromptPrompt, 500);
      objectPromptList.push_back(objectPrompt);
    }
    outputMap[OBJECT_PROMPTS] = objectPromptList;

    if (debug) {
      std::cout << "Object image prompts: " << std::endl;
      for (const auto &objectImagePrompt : objectPromptList) {
        std::cout << objectImagePrompt << std::endl;
      }
    }
  }

  void generateBackgroundPrompts() {
    std::cout << "Generating background image prompts" << std::endl;
    std::vector<std::string> backgroundPromptList;
    // check if backgrounds have been extracted
    if (outputMap.find(BACKGROUNDS) == outputMap.end()) {
      throw std::runtime_error("Backgrounds have not been extracted");
    }
    std::vector<std::string> backgrounds = outputMap[BACKGROUNDS];
    for (const auto &background : backgrounds) {
      std::string backgroundImagePromptPrompt =
          imageSetup + background + imageSettings + backgroundSettings;
      std::string backgroundImagePrompt =
          generate(backgroundImagePromptPrompt, 500);
      backgroundPromptList.push_back(backgroundImagePrompt);
    }
    outputMap[BACKGROUND_PROMPTS] = backgroundPromptList;

    if (debug) {
      std::cout << "Background image prompts: " << std::endl;
      for (const auto &backgroundImagePrompt : backgroundPromptList) {
        std::cout << backgroundImagePrompt << std::endl;
      }
    }
  }

  void jsonStoreData() {
    std::cout << "Storing data in json file" << std::endl;
    // create empty json object
    json j;

    // store whole colour string in json object
    for (const auto &output : outputMap) {
      std::string outputType = outputTypeMap.at(output.first);
      std::vector<std::string> outputData = output.second;
      j[outputType] = outputData;
    }

    // write updated json object to file
    std::ofstream outputFile(outputFilePath);
    outputFile << std::setw(4) << j << std::endl;
  }
};

// ----------------- Whisper Class -----------------
class Whisper {
 private:
  const std::string device;
  ov::genai::WhisperPipeline pipe;
  const std::string songId;
  const bool debug;

  void saveLyrics(std::string lyrics) {
    std::string outputFilePath = (lyricsDirPath / (songId + ".txt")).string();
    std::ofstream outputFile(outputFilePath);
    outputFile << lyrics;
    outputFile.close();
  }

 public:
  Whisper(std::string songId, bool debug)
      : device(getModelDevice()),
        pipe(whisperModelPath.string(), device),
        songId(songId),
        debug(debug) {
    std::cout << "Whisper Pipeline initialised with the following settings: "
              << std::endl;
    std::cout << "Model Path: " << whisperModelPath << std::endl;
    std::cout << "Device: " << device << std::endl;
    std::cout << "Song ID: " << songId << std::endl;
  }

  void generateLyrics() {
    std::cout << "Generating lyrics for song: " << songId << std::endl;
    std::string wavPath = (wavDirPath / (songId + ".wav")).string();
    std::cout << "wav Path: " << wavPath << std::endl;

    // set configs
    std::cout << "Setting generation config" << std::endl;
    ov::genai::WhisperGenerationConfig config = pipe.get_generation_config();
    config.max_new_tokens = 500;
    config.language = "<|en|>";
    config.task = "transcribe";
    config.return_timestamps = true;

    // obtain raw speech input
    std::cout << "Obtaining mp3 as raw input" << std::endl;
    ov::genai::RawSpeechInput rawSpeech = utils::audio::read_wav(wavPath);

    std::string lyrics = pipe.generate(rawSpeech, config);
    std::cout << "Lyrics generated: " << std::endl;
    std::cout << lyrics << std::endl;

    saveLyrics(lyrics);
    std::cout << "Lyrics saved to file" << std::endl;
  }
};

// ----------------- Stable Diffusion Class -----------------

class StableDiffusion {
 private:
  const std::string device;
  ov::genai::Text2ImagePipeline pipe;
  const std::string songId;
  const bool debug;

 public:
  StableDiffusion(std::string t2iPath, std::string songId, bool debug)
      : device(getModelDevice()),
        pipe(t2iPath, device),
        songId(songId),
        debug(debug) {
    std::cout
        << "Stable Diffusion Pipeline initialised with the following settings: "
        << std::endl;
    std::cout << "Model Path: " << t2iPath << std::endl;
    std::cout << "Device: " << device << std::endl;
    std::cout << "Song ID: " << songId << std::endl;
  }

  void generateImage(std::string prompt) {
    try {
      std::cout << "Generating image for prompt: " << prompt << std::endl;
      ov::Tensor image =
          pipe.generate(prompt, ov::genai::width(512), ov::genai::height(512),
                        ov::genai::num_inference_steps(20),
                        ov::genai::num_images_per_prompt(1));
      imwrite("image_%d.bmp", image, true);
      return EXIT_SUCCESS;
    } catch (const std::exception &error) {
      try {
        std::cerr << error.what() << '\n';
      } catch (const std::ios_base::failure &) {
      }
      return EXIT_FAILURE;
    } catch (...) {
      try {
        std::cerr << "Non-exception object thrown\n";
      } catch (const std::ios_base::failure &) {
      }
      return EXIT_FAILURE;
    }
  }
}

// ----------------- Main Function -----------------
int main(int argc, char *argv[]) {
  // default values for song and debug mode
  std::string songId = "let it go";
  bool debug = false;
  // declare supported options
  /*
  Allowed options:
  -h, --help: produce help message
  -d, --debug: enable debug mode
  -w, --whisper: use whisper mode
  -l, --llm: use llm mode
  -sd, --stable-diffusion: use stable diffusion mode
  -s, --song: specify song id
  --text_log: enable text logging

  Whisper only options
    --fixSampleRate: fix sample rate of audio file to 16kHz

  Stable diffusion only options
    --prompt <arg>: prompt to generate image

  LLM only options
    -c, --extractColour: extract colours from lyrics
    -p, --extractParticle: extract particle effect from lyrics
    -o, --extractObject: extract objects from lyrics
    -b, --extractBackground: extract backgrounds from lyrics
    --generateObjectPrompts: generate object image prompts
    --generateBackgroundPrompts: generate background image prompts
    --all: extract all llm features
  */
  po::options_description general_options("Allowed options");
  general_options.add_options()("help,h", "produce help message")(
      "debug,d", "enable debug mode")("whisper,w", "use whisper mode")(
      "llm,l", "use llm mode")("stable-diffusion,sd",
                               "use stable diffusion mode")(
      "song,s", po::value<std::string>(), "specify song id")(
      "text_log", "enable text logging");

  po::options_description whisper_options("Whisper only options");
  whisper_options.add_options()("fixSampleRate",
                                "fix sample rate of audio file");

  po::options_description llm_options("LLM only options");

  llm_options.add_options()("extractColour,c", "extract colours from lyrics")(
      "extractParticle,p", "extract particle effect from lyrics")(
      "extractObject,o", "extract objects from lyrics")(
      "extractBackground,b", "extract backgrounds from lyrics")(
      "generateObjectPrompts", "generate object image prompts")(
      "generateBackgroundPrompts", "generate background image prompts")(
      "all", "extract all llm features");

  po::options_description cmdline_options;
  cmdline_options.add(general_options).add(whisper_options).add(llm_options);

  po::variables_map vm;
  try {
    po::store(po::parse_command_line(argc, argv, cmdline_options), vm);
    po::notify(vm);
  } catch (const po::error &e) {
    std::cerr << "Error: " << e.what() << std::endl;
    return 1;
  }

  // if help flag is set, print help message and exit
  if (vm.count("help")) {
    std::cout << desc << std::endl;
    return 0;
  }

  /* ----------------- Check Flag Errors -----------------
  Checking flags for any errors before we go to main program
  i.e. any required flags that are not set
  */
  // check if model type is specified
  if (!vm.count("whisper") && !vm.count("llm") &&
      !vm.count("stable-diffusion")) {
    std::cerr << "Error: Please specify a model type to use" << std::endl;
    return 1;
  }

  // if whisper, song has to be set
  if (vm.count("whisper") && !vm.count("song")) {
    std::cerr << "Error: Please specify a song id" << std::endl;
    return 1;
  }

  // if stable diffusion, prompt has to be set
  if (vm.count("stable-diffusion") && !vm.count("prompt")) {
    std::cerr << "Error: Please specify a prompt" << std::endl;
    return 1;
  }

  // ----------------- Check Flag -----------------
  // if text_log flag is set, redirect console output to log file
  if (vm.count("text_log")) {
    redirectConsoleOutput();
  }

  // check if song is specified
  if (vm.count("song")) {
    songId = vm["song"].as<std::string>();
  }

  // check if debug flag is set
  if (vm.count("debug")) {
    debug = true;
  }

  if (vm.count("all")) {
    vm.insert({"extractColour", po::variable_value()});
    vm.insert({"extractParticle", po::variable_value()});
    vm.insert({"extractObject", po::variable_value()});
    vm.insert({"extractBackground", po::variable_value()});
    vm.insert({"generateObjectPrompts", po::variable_value()});
    vm.insert({"generateBackgroundPrompts", po::variable_value()});
  }

  // ================== Stable Diffusion Pipeline ==================
  if (vm.count("stable-diffusion")) {
    std::cout << "Starting Stable Diffusion Pipeline" << std::endl;
    try {
      StableDiffusion stableDiffusion(stableDiffusionModelPath, songId, debug);
      stableDiffusion.generateImage(vm["prompt"].as<std::string>());
    } catch (const std::exception &e) {
      std::cerr << "Error: " << e.what() << std::endl;
      cleanup();
      return 1;
    }
  }

  // ================== Whisper Pipeline ==================
  if (vm.count("whisper")) {
    // check if fixSampleRate flag is set
    if (vm.count("fixSampleRate")) {
      std::cout << "Fixing sample rate of audio file" << std::endl;
      std::string wavPath = (wavDirPath / (songId + ".wav")).string();
      std::string outputFilePath =
          (wavDirPath / (songId + "_fixed.wav")).string();
      utils::audio::fixSampleRate(wavPath, outputFilePath);
      std::cout << "Sample rate fixed" << std::endl;
    }
    // main inference pipeline
    else {
      std::cout << "Starting Whisper Pipeline" << std::endl;
      try {
        Whisper whisper(songId, debug);
        whisper.generateLyrics();
      } catch (const std::exception &e) {
        std::cerr << "Error: " << e.what() << std::endl;
        cleanup();
        return 1;
      }
    }
  }

  // ================== LLM Pipeline ==================
  if (vm.count("llm")) {
    std::cout << "Starting LLM Pipeline" << std::endl;
    try {
      LLM llm(modelPath, songId, debug);
      if (vm.count("extractColour")) {
        llm.extractColours();
      }
      if (vm.count("extractParticle")) {
        llm.extractParticleEffect();
      }
      if (vm.count("extractObject")) {
        llm.extractObjects();
      }
      if (vm.count("extractBackground")) {
        llm.extractBackgrounds();
      }
      if (vm.count("generateObjectPrompts")) {
        llm.generateObjectPrompts();
      }
      if (vm.count("generateBackgroundPrompts")) {
        llm.generateBackgroundPrompts();
      }
      llm.jsonStoreData();
    } catch (const std::exception &e) {
      std::cerr << "Error: " << e.what() << std::endl;
      cleanup();
      return 1;
    }
  }

  std::cout << "LLM Pipeline completed" << std::endl;

  // cleanup and close log file
  cleanup();
  return 0;
}

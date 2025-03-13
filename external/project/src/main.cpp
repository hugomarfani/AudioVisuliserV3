#include <algorithm>
#include <boost/program_options.hpp>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <nlohmann/json.hpp>
#include <openvino/genai/image_generation/text2image_pipeline.hpp>
#include <openvino/genai/llm_pipeline.hpp>
#include <openvino/genai/whisper_pipeline.hpp>
#include <openvino/openvino.hpp>
#include <random>
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

std::string statusPrompt =
    "Analyze the lyrics of the song provided and choose "
    "1 colour from the zones of regluation that best fits the emotions of the "
    "song. Output the name of the selected colour and no other word. Here is "
    "the list of colours and the meanings they represent:"
    "1. Red: intense emotions like anger or frustration"
    "2. Blue: sad, tired, or bored emotions"
    "3. Yellow: excited or anxious emotions"
    "4. Green: calm and happy emotions";

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
    "regex. The Background Name must have a $ sign before and after the word:"
    "Background 1: $Background name$"
    "Background 2: $Background name$"
    "Background 3: $Background name$";

std::string imageSetup =
    "Create a detailed prompt to be passed to a text to image generation model "
    "to generate an image of the song. There is no need to add more settings, "
    "only the prompt is required. The prompt should be in a text format and "
    "have no markdown or HTML tags. The prompt should be detailed and "
    "specific, with each detail separated by a comma. The maximum number of words is 55, do not go over that limit";

std::string imageSettings =
    ". The prompt should include the following settings:";

std::string objectSettings = "black very simple object image with white background, minimalistic";

std::string backgroundSettings =
    "colour: colourful background, "
    "suitable for children and family, light pastel colours";

// ----------------- paths -----------------
std::filesystem::path currentDirectory = std::filesystem::current_path();
std::string gemmaModelPath;
std::string smallerLLMPath;
std::string stableDiffusionModelPath;
std::filesystem::path whisperModelPath;
std::filesystem::path songDataPath;
std::string particleListFilePath;
std::string logPath;
std::filesystem::path lyricsDirPath;
std::filesystem::path wavDirPath;
std::filesystem::path imageDirPath;

void setPaths() {
  gemmaModelPath =
      (currentDirectory / "AiResources" / "gemma-2-9b-it-int4-ov").string();
  smallerLLMPath =
      (currentDirectory / "AiResources" / "Phi-3-mini-4k-instruct-int4-ov").string();
  stableDiffusionModelPath =
      (currentDirectory / "AiResources" / "dreamlike_anime_1_0_ov" / "FP16")
          .string();
  whisperModelPath =
      (currentDirectory / "AiResources" / "distil-whisper-large-v3-int8-ov");
  songDataPath = (currentDirectory / "assets" / "songData");
  particleListFilePath =
      (currentDirectory / "assets" / "particleList.json").string();
  logPath = (currentDirectory / "assets" / "aiLog.txt").string();
  lyricsDirPath = (currentDirectory / "assets" / "lyrics");
  wavDirPath = (currentDirectory / "assets" / "audio");
  imageDirPath = (currentDirectory / "assets" / "images");
}


// std::string gemmaModelPath =
//     (currentDirectory / "AiResources" / "gemma-2-9b-it-int4-ov").string();
// // std::string stableDiffusionModelPath =
// //     (currentDirectory / "AiResources" / "FLUX.1-schnell-int8-ov").string();
// std::string stableDiffusionModelPath =
//     (currentDirectory / "AiResources" / "dreamlike_anime_1_0_ov" / "FP16")
//         .string();
// // using whisper path again after this so needs to be filesystem::path
// std::filesystem::path whisperModelPath =
//     (currentDirectory / "AiResources" / "distil-whisper-large-v3-int8-ov");
// std::filesystem::path songDataPath = (currentDirectory / "assets" / "songData");
// std::string particleListFilePath =
//     (currentDirectory / "assets" / "particleList.json").string();
// std::string logPath = (currentDirectory / "assets" / "aiLog.txt").string();
// std::filesystem::path lyricsDirPath = (currentDirectory / "assets" / "lyrics");
// std::filesystem::path wavDirPath = (currentDirectory / "assets" / "audio");
// std::filesystem::path imageDirPath = (currentDirectory / "assets" / "images");

// ----------------- Temp ONNX Paths -----------------
// std::filesystem::path sdPath =
//     (currentDirectory / "AiResources" / "sd-v1-5-int8-onnx");
// std::string textEncoderPath = (sdPath / "text_encoder" /
// "model.onnx").string(); std::string


// ----------------- Finish Functions -----------------
// Specific Finish statements, which trigger flags in Super Happy Space
void finishWhisper() {
  std::cout << "Finished Whisper" << std::endl;
}
void finishLLM() {
  std::cout << "Finished LLM" << std::endl;
}
void finishStableDiffusion() {
  std::cout << "Finished Stable Diffusion" << std::endl;
}

void finishAISetup() {
  std::cout << "Finished AI Setup" << std::endl;
}

void finishStatusExtraction() {
  std::cout << "Finished Status Extraction" << std::endl;
}
void finishColourExtraction() {
  std::cout << "Finished Colour Extraction" << std::endl;
}
void finishParticleExtraction() {
  std::cout << "Finished Particle Extraction" << std::endl;
}
void finishObjectExtraction() {
  std::cout << "Finished Object Extraction" << std::endl;
}
void finishBackgroundExtraction() {
  std::cout << "Finished Background Extraction" << std::endl;
}
void finishObjectPrompts() {
  std::cout << "Finished Object Prompts" << std::endl;
}
void finishBackgroundPrompts() {
  std::cout << "Finished Background Prompts" << std::endl;
}

void finishJsonStorage() {
  std::cout << "Finished Json Storage" << std::endl;
}


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
  std::regex optionsRegex("\\$(.*?)\\$");
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
        unstrippedOption.substr(1, unstrippedOption.size() - 1);
    options.push_back(option);
    next++;
  }
  return options;
}

// ----------------- Enums -----------------

enum LLMOutputType {
  // fields which are not generated by LLM
  ID,
  TITLE,
  UPLOADER,
  AUDIOPATH,
  JACKET,
  IMAGES,
  MOODS,
  CREATEDAT,
  UPDATEDAT,

  // fields which are generated by LLM
  STATUS,
  COLOURS,
  COLOURS_REASON,
  PARTICLES,
  OBJECTS,
  BACKGROUNDS,
  OBJECT_PROMPTS,
  BACKGROUND_PROMPTS,
  SHADER_BACKGROUND,
  SHADER_TEXTURE,
  PARTICLE_COLOUR
};

const std::unordered_map<LLMOutputType, std::string> outputTypeMap = {
    {ID, "id"},
    {TITLE, "title"},
    {UPLOADER, "uploader"},
    {AUDIOPATH, "audioPath"},
    {JACKET, "jacket"},
    {IMAGES, "images"},
    {MOODS, "moods"},
    {CREATEDAT, "createdAt"},
    {UPDATEDAT, "updatedAt"},
    {STATUS, "status"},
    {COLOURS, "colours"},
    {COLOURS_REASON, "colours_reason"},
    {PARTICLES, "particles"},
    {OBJECTS, "objects"},
    {BACKGROUNDS, "backgrounds"},
    {OBJECT_PROMPTS, "object_prompts"},
    {BACKGROUND_PROMPTS, "background_prompts"},
    {SHADER_BACKGROUND, "shaderBackground"},
    {SHADER_TEXTURE, "shaderTexture"},
    {PARTICLE_COLOUR, "particleColour"}
  };

const std::unordered_map<std::string, LLMOutputType> outputTypeMapReverse = {
    {"id", ID},
    {"title", TITLE},
    {"uploader", UPLOADER},
    {"audioPath", AUDIOPATH},
    {"jacket", JACKET},
    {"images", IMAGES},
    {"moods", MOODS},
    {"createdAt", CREATEDAT},
    {"updatedAt", UPDATEDAT},
    {"status", STATUS},
    {"colours", COLOURS},
    {"colours_reason", COLOURS_REASON},
    {"particles", PARTICLES},
    {"objects", OBJECTS},
    {"backgrounds", BACKGROUNDS},
    {"object_prompts", OBJECT_PROMPTS},
    {"background_prompts", BACKGROUND_PROMPTS},
    {"shaderBackground", SHADER_BACKGROUND},
    {"shaderTexture", SHADER_TEXTURE},
    {"particleColour", PARTICLE_COLOUR}
  };

const std::unordered_map<LLMOutputType, bool> outputTypeIsVector = {
    {ID, false},
    {TITLE, false},
    {UPLOADER, false},
    {AUDIOPATH, false},
    {JACKET, false},
    {IMAGES, true},
    {MOODS, true},
    {CREATEDAT, false},
    {UPDATEDAT, false},
    {STATUS, false},
    {COLOURS, true},
    {COLOURS_REASON, true},
    {PARTICLES, true},
    {OBJECTS, true},
    {BACKGROUNDS, true},
    {OBJECT_PROMPTS, true},
    {BACKGROUND_PROMPTS, true},
    {SHADER_BACKGROUND, false},
    {SHADER_TEXTURE, false},
    {PARTICLE_COLOUR, true}
  };

// ----------------- LLM Class -----------------
class LLM {
 private:
  const std::string device;
  ov::genai::LLMPipeline pipe;
  const std::string songName;
  const std::string lyrics;
  const bool debug;
  std::string lyricsSetup;
  std::string shorterLyricsSetup;
  std::string outputFilePath;

  std::unordered_map<LLMOutputType, std::vector<std::string>> outputMap;

  std::string generate(std::string prompt, int max_new_tokens) {
    return pipe.generate(prompt, ov::genai::max_new_tokens(max_new_tokens));
  }

  void retrieveCurrentOutput() {
    json j;
    // read existing json data from file if it exists
    std::ifstream inputFile(outputFilePath);
    if (inputFile.is_open()) {
      std::cout << "Reading existing data from file" << std::endl;
      inputFile >> j;
      inputFile.close();
    } else {
      j = json();
    }
    // store existing data in outputMap
    for (const auto &output : j.items()) {
      // std ::cout << "output type: " << output.key() << std::endl;
      LLMOutputType outputType = outputTypeMapReverse.at(output.key());
      if (outputTypeIsVector.at(outputType)) {
        outputMap[outputType] = output.value();
      } else {
        // std::cout << "output value: " << output.value().get<std::string>()
        //           << std::endl;
        outputMap[outputType] =
            std::vector<std::string>{output.value().get<std::string>()};
      }
    }
  }

 public:
  LLM(std::string llmModelPath, std::string songName, bool debug)
      : device(getModelDevice()),
        pipe(llmModelPath, device),
        songName(songName),
        lyrics(getLyrics(songName)),
        debug(debug),
        outputFilePath((songDataPath / (songName + ".json")).string()) {
    std::cout << "LLM Pipeline initialised with the following settings: "
              << std::endl;
    std::cout << "Model Path: " << llmModelPath << std::endl;
    std::cout << "Device: " << device << std::endl;
    std::cout << "Song Name: " << songName << std::endl;
    std::cout << "Lyrics: " << lyrics << std::endl;
    std::cout << "Output File Path: " << outputFilePath << std::endl;
    lyricsSetup = lyricsPrompt + " " + songName + "\n" + lyrics;
    std::string truncatedLyrics = lyrics.substr(0, std::min(size_t(500), lyrics.length()));
    shorterLyricsSetup = lyricsPrompt + " " + songName + "\n" + truncatedLyrics;
    outputMap = std::unordered_map<LLMOutputType, std::vector<std::string>>();
    retrieveCurrentOutput();
  }

  void extractColours() {
    std ::cout << "Extracting colours from lyrics" << std::endl;
    std::string colourPrompt = lyricsSetup + colourExtractionPrompt;
    std::string colourOutput;
    try{
      colourOutput = generate(colourPrompt, 500);
    } catch (const std::bad_alloc& e) {
      std::cerr << "Bad allocation error: " << e.what() << std::endl;
      std::cerr << "Trying with shorter lyrics" << std::endl;
      colourOutput = generate(shorterLyricsSetup + colourExtractionPrompt, 500);
    }

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

  void extractStatus() {
    std::cout << "Extracting status from lyrics" << std::endl;
    std::string statusPrompt = lyricsSetup + statusPrompt + "\n";
    try{
      std::string statusOutput = generate(statusPrompt, 100);
      outputMap[STATUS] = getOptionsFromLlmOutput(statusOutput);
    } catch (const std::bad_alloc& e) {
      std::cerr << "Bad allocation error: " << e.what() << std::endl;
      std::cerr << "Trying with shorter lyrics" << std::endl;
      std::string statusOutput = generate(shorterLyricsSetup + statusPrompt, 100);
      outputMap[STATUS] = getOptionsFromLlmOutput(statusOutput);
    }

    outputMap[STATUS] = getOptionsFromLlmOutput(statusOutput);

    if (debug) {
      std::cout << "Status extracted: " << std::endl;
      std::cout << statusOutput << std::endl;
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
      // store data in json object based on whether it is a vector or not
      if (outputTypeIsVector.at(output.first)) {
        j[outputType] = outputData;
      } else {
        j[outputType] = outputData[0];
      }
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
    std::cout << "Obtaining wav as raw input" << std::endl;
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
  StableDiffusion(ov::genai::Text2ImagePipeline pipe, std::string device,
                  std::string songId, bool debug)
      : device(device), pipe(pipe), songId(songId), debug(debug) {
    std::cout << "Stable Diffusion Pipeline initialised with the following "
                 "settings: "
              << std::endl;
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
      std::string imageFilePath =
          (imageDirPath / (songId + "_%d.bmp")).string();
      imwrite(imageFilePath, image, true);
    } catch (const std::exception &error) {
      try {
        std::cerr << error.what() << '\n';
      } catch (const std::ios_base::failure &) {
      }
    } catch (...) {
      try {
        std::cerr << "Non-exception object thrown\n";
      } catch (const std::ios_base::failure &) {
      }
    }
  }
};

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
  -S, --stable-diffusion: use stable diffusion mode
  -s, --song: specify song id
  --text_log: enable text logging
  -m, --model: specify model name
  -e, --electron: enable electron mode, exe is run from Super Happy Space

  Whisper only options
    --fixSampleRate: fix sample rate of audio file to 16kHz

  Stable diffusion only options
    --prompt <arg>: prompt to generate image

  LLM only options
    --smallerLLM: use smaller LLM model, with less parameters
    --status: extract status from lyrics
    -c, --extractColour: extract colours from lyrics
    -p, --extractParticle: extract particle effect from lyrics
    -o, --extractObject: extract objects from lyrics
    -b, --extractBackground: extract backgrounds from lyrics
    --generateObjectPrompts: generate object image prompts
    --generateBackgroundPrompts: generate background image prompts
    --all: extract all llm features
  */
  po::options_description general_options("Allowed options");
  general_options.add_options()
      ("help,h", "produce help message")
      ("debug,d", "enable debug mode")
      ("whisper,w", "use whisper mode")
      ("llm,l", "use llm mode")
      ("stable-diffusion,S","use stable diffusion mode")
      ("song,s", po::value<std::string>(), "specify song id")
      ("text_log", "enable text logging")
      ("model,m", po::value<std::string>(), "specify model name")
      ("electron,e", "enable electron mode");

  po::options_description stable_diffusion_options(
      "Stable Diffusion only options");
  stable_diffusion_options.add_options()("prompt", po::value<std::string>(),
                                         "prompt to generate image");

  po::options_description whisper_options("Whisper only options");
  whisper_options.add_options()("fixSampleRate",
                                "fix sample rate of audio file");

  po::options_description llm_options("LLM only options");

  llm_options.add_options()
      ("status", "extract status from lyrics")
      ("smallerLLM", "use smaller LLM model, with less parameters")
      ("extractColour,c", "extract colours from lyrics")(
      "extractParticle,p", "extract particle effect from lyrics")(
      "extractObject,o", "extract objects from lyrics")(
      "extractBackground,b", "extract backgrounds from lyrics")(
      "generateObjectPrompts", "generate object image prompts")(
      "generateBackgroundPrompts", "generate background image prompts")(
      "all", "extract all llm features");

  po::options_description cmdline_options;
  cmdline_options.add(general_options)
      .add(stable_diffusion_options)
      .add(whisper_options)
      .add(llm_options);

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
    std::cout << general_options << std::endl;
    std::cout << stable_diffusion_options << std::endl;
    std::cout << whisper_options << std::endl;
    std::cout << llm_options << std::endl;
    return 0;
  }

  if (vm.count("electron")) {
    std::cout << "Running in electron mode" << std::endl;
    // set current directory to electron directory
    currentDirectory = (currentDirectory / "resources");
  }

  // set paths -> after current directory is set
  setPaths();

  std::cout << "Current Directory: " << currentDirectory << std::endl;

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

  // if model name is declared, set all paths to it
  if (vm.count("model")) {
    std::string modelName = vm["model"].as<std::string>();
    std::string modelPath =
        (currentDirectory / "AiResources" / modelName).string();
    gemmaModelPath = modelPath;
    smallerLLMPath = modelPath;
    stableDiffusionModelPath = modelPath;
    whisperModelPath = modelPath;
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
  // DEPRECATED
  // if (vm.count("stable-diffusion")) {
  //   std::cout << "Starting Stable Diffusion Pipeline" << std::endl;
  //   try {
  //     // std::string device = getModelDevice();
  //     std::string device = "CPU";
  //     std::cout << "starting stable diffusion" << std::endl;
  //     std::cout << "model path: " << stableDiffusionModelPath << std::endl;
  //     std::cout << "device: " << device << std::endl;
  //     ov::genai::Text2ImagePipeline t2iPipe(stableDiffusionModelPath, device);
  //     std::cout << "pipe created" << std::endl;
  //     // StableDiffusion stableDiffusion(t2iPipe, device, songId, debug);
  //     // stableDiffusion.generateImage(vm["prompt"].as<std::string>());
  //     finishStableDiffusion();
  //   } catch (const std::exception &e) {
  //     std::cerr << "Error: " << e.what() << std::endl;
  //     cleanup();
  //     finishStableDiffusion();
  //     return 1;
  //   } catch (...) {
  //     std::cerr << "Error: Unknown error" << std::endl;
  //     cleanup();
  //     finishStableDiffusion();
  //     return 1;
  //   }
  // }

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
        finishAISetup();
        whisper.generateLyrics();
        finishWhisper();
        // delete wav file after lyrics have been generated
        std::string wavPath = (wavDirPath / (songId + ".wav")).string();
        std::filesystem::remove(wavPath);
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
      if (vm.count("smallerLLM")){
        gemmaModelPath = smallerLLMPath;
      }
      LLM llm(gemmaModelPath, songId, debug);
      finishAISetup();
      if (vm.count("status")) {
        llm.extractStatus();
        finishStatusExtraction();
      }
      if (vm.count("extractColour")) {
        llm.extractColours();
        finishColourExtraction();
      }
      if (vm.count("extractParticle")) {
        llm.extractParticleEffect();
        finishParticleExtraction();
      }
      if (vm.count("extractObject")) {
        llm.extractObjects();
        finishObjectExtraction();
      }
      if (vm.count("extractBackground")) {
        llm.extractBackgrounds();
        finishBackgroundExtraction();
      }
      if (vm.count("generateObjectPrompts")) {
        llm.generateObjectPrompts();
        finishObjectPrompts();
      }
      if (vm.count("generateBackgroundPrompts")) {
        llm.generateBackgroundPrompts();
        finishBackgroundPrompts();
      }
      llm.jsonStoreData();
      finishJsonStorage();
      finishLLM();
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

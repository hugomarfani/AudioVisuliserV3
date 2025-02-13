#include <openvino/genai/llm_pipeline.hpp>
#include <openvino/openvino.hpp>
#include <nlohmann/json.hpp>
#include <boost/program_options.hpp>
#include <iostream>
#include <string>
#include <tuple>
#include <vector>
#include <iterator>
#include <algorithm>
#include <fstream>
#include <ranges>
#include <regex>
#include <filesystem>
#include <stdexcept>
#include <unordered_map>

std::ofstream logFile;

using json = nlohmann::json;
namespace po = boost::program_options;

// ----------------- Prompts -----------------
std::string colourExtractionPrompt =
    "Analyze the lyrics of the song provided and extract 5 unique,"
    "unusual colors (avoid common colors like red, green, or blue) that are explicitly mentioned or strongly implied."
    "Represent each color in #RRGGBB hexadecimal format. Ensure the output is in the following exact format"
    "for easy extraction using regex:"
    "Color 1: #RRGGBB"
    "Color 2: #RRGGBB"
    "Color 3: #RRGGBB"
    "Color 4: #RRGGBB"
    "Color 5: #RRGGBB"
    "If a color is not explicitly named, infer it from vivid imagery or metaphors in the lyrics."
    "Provide the formatted output, followed by a brief explanation of why each color was chosen, in the following format:"
    "Color 1 reason: Explanation"
    "Color 2 reason: Explanation"
    "Color 3 reason: Explanation"
    "Color 4 reason: Explanation"
    "Color 5 reason: Explanation";

std::string particleSelectionPrompt =
    "Analyze the lyrics of the song provided and choose 1 particle effect from the following list,"
    "that best fits the mood and theme of the song. Output the name of the selected particle effect and no other word. Here is the list of particle effects:";

std::string lyricsPrompt = "These are the lyrics for";

std::string objectExtractionPrompt =
    "Analyze the lyrics of the song provided and extract 3 unique, unusual objects that are explicitly mentioned or strongly implied."
    "Give the output in the following exact format for easy extraction using regex:"
    "Object 1: $Object name$"
    "Object 2: $Object name$"
    "Object 3: $Object name$";

std::string backgroundExtractionPrompt =
    "Analyze the lyrics of the song provided and extract 3 unique, unusual backgrounds that are explicitly mentioned or strongly implied."
    "Give the output in the following exact format for easy extraction using regex:"
    "Background 1: $Background name$"
    "Background 2: $Background name$"
    "Background 3: $Background name$";

std::string imageSetup =
    "Create a prompt to be passed to a text to image generation model to generate an image of ";

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
std::string modelPath = (currentDirectory / "AiResources" / "gemma-2-9b-it-int4-ov").string();
std::string outputFilePath = (currentDirectory / "AiResources" / "./output.json").string();
std::string particleListFilePath = (currentDirectory / "AiResources" / "particleList.json").string();
std::string logPath = (currentDirectory / "AiResources" / "./log.txt").string();
std::filesystem::path lyricsDirPath = (currentDirectory / "AiResources" / "lyrics");

// ----------------- Log Functions -----------------
void redirectConsoleOutput()
{
  logFile.open(logPath, std::ofstream::out | std::ofstream::trunc);
  logFile.close();
  logFile.open(logPath, std::ios::out | std::ios::app);
  if (!logFile)
  {
    std::cerr << "Error Unable to open log file!" << std::endl;
    exit(EXIT_FAILURE);
  }
  std::cout.rdbuf(logFile.rdbuf());
  std::cerr.rdbuf(logFile.rdbuf());
}

void cleanup()
{
  if (logFile.is_open())
  {
    logFile.flush();
    logFile.close();
  }
}

// ----------------- Helper Functions -----------------

/**
 * @brief Retrieves the model device to be used for computation.
 *
 * This function queries the available devices from the OpenVINO core and selects an appropriate device for computation.
 * It prioritizes GPU devices if available, otherwise, it selects the first available device.
 *
 * @return std::string The name of the selected device.
 *
 * @throws std::runtime_error If no devices are available.
 */
std::string getModelDevice()
{
  ov::Core core;

  std::vector<std::string> availableDevices = core.get_available_devices();
  // print available devices
  // for (const auto &device : availableDevices)
  // {
  //     std::cout << "Available device: " << device << std::endl;
  // }
  std::ranges::copy(availableDevices, std::ostream_iterator<std::string>(std::cout, ", "));

  // raise error if no devices are available
  if (availableDevices.empty())
  {
    throw std::runtime_error("No devices available");
  }

  for (const auto &device : availableDevices)
  {
    // use GPU if available
    if (device.find("GPU") != std::string::npos)
    {
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
 * in the lyrics directory. The file should be named as the song name with a .txt extension.
 *
 * @param songName The name of the song whose lyrics are to be retrieved.
 * @return A string containing the lyrics of the song.
 * @throws std::runtime_error If the lyrics file cannot be opened.
 */
std::string getLyrics(std::string songName)
{
  // read in lyrics from lyrics folder under song.txt
  std::string lyrics = "";
  std::string line;
  std::ifstream lyricsFile;
  std::string lyricsFilePath = (lyricsDirPath / (songName + ".txt")).string();
  std::cout << "Lyrics File Path: " << lyricsFilePath << std::endl;
  lyricsFile.open(lyricsFilePath);
  if (lyricsFile.is_open())
  {
    while (getline(lyricsFile, line))
    {
      lyrics += line + "\n";
    }
    lyricsFile.close();
  }
  else
  {
    throw std::runtime_error("Unable to open file");
  }

  return lyrics;
}

auto getParticleEffectFromJson(std::string filePath)
{
  // read in particle effects from json file
  std::ifstream inputFile(filePath);
  if (!inputFile.is_open())
  {
    throw std::runtime_error("Unable to open file");
  }
  json jsonData;
  inputFile >> jsonData;
  inputFile.close();

  if (jsonData.contains("particles") && jsonData["particles"].is_array())
  {
    return jsonData["particles"];
  }
  else
  {
    throw std::runtime_error("Invalid json format");
  }
}

std::vector<std::string> getOptionsFromLlmOutput(std::string llmOutput)
{
  // regex to match all options, sandwiched by
  std::regex optionsRegex(": \\$(.*?)\\$");
  // create iterator to iterate through matches
  std::sregex_iterator next(llmOutput.begin(), llmOutput.end(), optionsRegex);
  std::sregex_iterator end;
  std::vector<std::string> options;
  // iterate through matches and store in vector
  while (next != end)
  {
    std::smatch match = *next;
    std::string unstrippedOption = match.str();
    // strip the option of the leading and trailing characters (starts with ": $" and ends with "$")
    // make sure length is at least 4 to avoid out of bounds error
    if (unstrippedOption.size() < 4)
    {
      throw std::runtime_error("Invalid option format");
    }
    std::string option = unstrippedOption.substr(3, unstrippedOption.size() - 4);
    options.push_back(option);
    next++;
  }
  return options;
}

// ----------------- Enums -----------------

enum LLMOutputType
{
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
class LLM
{
private:
  const std::string device;
  ov::genai::LLMPipeline pipe;
  const std::string songName;
  const std::string lyrics;
  const bool debug;
  std::string lyricsSetup;

  std::unordered_map<LLMOutputType, std::vector<std::string>> outputMap;

  std::string generate(std::string prompt, int max_new_tokens)
  {
    return pipe.generate(prompt, ov::genai::max_new_tokens(max_new_tokens));
  }

  void retrieveCurrentOutput()
  {
    json j;
    // read existing json data from file if it exists
    std::ifstream inputFile(outputFilePath);
    if (inputFile.is_open())
    {
      inputFile >> j;
      inputFile.close();
    }
    else
    {
      j = json();
    }
    // store existing data in outputMap
    for (const auto &output : j.items())
    {
      LLMOutputType outputType = outputTypeMapReverse.at(output.key());
      outputMap[outputType] = output.value();
    }
  }

public:
  LLM(std::string modelPath, std::string songName, bool debug)
      : device(getModelDevice()), pipe(modelPath, device), songName(songName), lyrics(getLyrics(songName)), debug(debug)
  {
    std::cout << "LLM Pipeline initialised with the following settings: " << std::endl;
    std::cout << "Model Path: " << modelPath << std::endl;
    std::cout << "Device: " << device << std::endl;
    std::cout << "Song Name: " << songName << std::endl;
    lyricsSetup = lyricsPrompt + " " + songName + "\n" + lyrics;
    outputMap = std::unordered_map<LLMOutputType, std::vector<std::string>>();
  }

  void extractColours()
  {
    std ::cout << "Extracting colours from lyrics" << std::endl;
    std::string colourPrompt = lyricsSetup + colourExtractionPrompt;
    std::string colourOutput = generate(colourPrompt, 500);
    std ::cout << "Extracted colours from lyrics" << std::endl;

    std::vector<std::string> colours;
    // regex to match hex colours
    std::regex hexColour("#[0-9a-fA-F]{6}");
    // create iterator to iterate through matches
    std::sregex_iterator next(colourOutput.begin(), colourOutput.end(), hexColour);
    std::sregex_iterator end;
    // iterate through matches and store in json object
    while (next != end)
    {
      std::smatch match = *next;
      colours.push_back(match.str());
      next++;
    }

    outputMap[COLOURS] = colours;
    outputMap[COLOURS_REASON] = {colourOutput};

    if (debug)
    {
      std::cout << "Colours extracted: " << std::endl;
      std::cout << colourOutput << std::endl;
    }
  }

  void extractParticleEffect()
  {
    std::cout << "Obtaining list of particle effects" << std::endl;
    std::vector<std::string> particleList = getParticleEffectFromJson(particleListFilePath);
    std::string particlePrompt = lyricsSetup + particleSelectionPrompt + "\n";
    for (const auto &particle : particleList)
    {
      particlePrompt += particle + "\n";
    }
    std::string particleOutput = generate(particlePrompt, 100);
    std::cout << "Obtained list of particle effects" << std::endl;

    outputMap[PARTICLES] = getOptionsFromLlmOutput(particleOutput);
    if (debug)
    {
      std::cout << "Particle effect extracted: " << std::endl;
      std::cout << particleOutput << std::endl;
    }
  }

  void extractObjects()
  {
    std::string objectPrompt = lyricsSetup + objectExtractionPrompt;
    std::string objectOutput = generate(objectPrompt, 500);
    std::vector<std::string> objects = getOptionsFromLlmOutput(objectOutput);

    outputMap[OBJECTS] = objects;

    if (debug)
    {
      std::cout << "Objects extracted: " << std::endl;
      for (const auto &object : objects)
      {
        std::cout << object << std::endl;
      }
      std ::cout << "original output: " << std::endl;
      std::cout << objectOutput << std::endl;
    }
  }

  void extractBackgrounds()
  {
    std::string backgroundPrompt = lyricsSetup + backgroundExtractionPrompt;
    std::string backgroundOutput = generate(backgroundPrompt, 500);
    std::vector<std::string> backgrounds = getOptionsFromLlmOutput(backgroundOutput);

    outputMap[BACKGROUNDS] = backgrounds;

    if (debug)
    {
      std::cout << "Backgrounds extracted: " << std::endl;
      for (const auto &background : backgrounds)
      {
        std::cout << background << std::endl;
      }
      std::cout << "original output: " << std::endl;
      std::cout << backgroundOutput << std::endl;
    }
  }

  void generateObjectPrompts()
  {
    std::vector<std::string> objectPromptList;
    // check if objects have been extracted
    if (outputMap.find(OBJECTS) == outputMap.end())
    {
      throw std::runtime_error("Objects have not been extracted");
    }
    std::vector<std::string> objects = outputMap[OBJECTS];
    for (const auto &object : objects)
    {
      std::string objectPromptPrompt = imageSetup + object + imageSettings;
      std::string objectPrompt = generate(objectPromptPrompt, 500);
      objectPromptList.push_back(objectPrompt);
    }
    outputMap[OBJECT_PROMPTS] = objectPromptList;

    if (debug)
    {
      std::cout << "Object image prompts: " << std::endl;
      for (const auto &objectImagePrompt : objectPromptList)
      {
        std::cout << objectImagePrompt << std::endl;
      }
    }
  }

  void generateBackgroundPrompts()
  {
    std::vector<std::string> backgroundPromptList;
    // check if backgrounds have been extracted
    if (outputMap.find(BACKGROUNDS) == outputMap.end())
    {
      throw std::runtime_error("Backgrounds have not been extracted");
    }
    std::vector<std::string> backgrounds = outputMap[BACKGROUNDS];
    for (const auto &background : backgrounds)
    {
      std::string backgroundImagePromptPrompt = imageSetup + background + imageSettings + backgroundSettings;
      std::string backgroundImagePrompt = generate(backgroundImagePromptPrompt, 500);
      backgroundPromptList.push_back(backgroundImagePrompt);
    }
    outputMap[BACKGROUND_PROMPTS] = backgroundPromptList;

    if (debug)
    {
      std::cout << "Background image prompts: " << std::endl;
      for (const auto &backgroundImagePrompt : backgroundPromptList)
      {
        std::cout << backgroundImagePrompt << std::endl;
      }
    }
  }

  void jsonStoreData()
  {
    // create empty json object
    json j;

    // store whole colour string in json object
    for (const auto &output : outputMap)
    {
      std::string outputType = outputTypeMap.at(output.first);
      std::vector<std::string> outputData = output.second;
      j[outputType] = outputData;
    }

    // write updated json object to file
    std::ofstream outputFile(outputFilePath);
    outputFile << std::setw(4) << j << std::endl;
  }
};

int main(int argc, char *argv[])
{
  std::string songName = "let it go";
  bool debug = false;
  // declare supported options
  po::options_description desc("Allowed options");
  desc.add_options()("help", "produce help message")("debug", "enable debug mode")("song", po::value<std::string>(), "specify song name")("text_log", "enable text logging")("extractColour,c", "extract colours from lyrics")("extractParticle,p", "extract particle effect from lyrics")("extractObject,o", "extract objects from lyrics")("extractBackground,b", "extract backgrounds from lyrics")("generateObjectPrompts", "generate object image prompts")("generateBackgroundPrompts", "generate background image prompts")("all", "extract all features");

  po::variables_map vm;
  try
  {
    po::store(po::parse_command_line(argc, argv, desc), vm);
    po::notify(vm);
  }
  catch (const po::error &e)
  {
    std::cerr << "Error: " << e.what() << std::endl;
    return 1;
  }

  if (vm.count("help"))
  {
    std::cout << desc << std::endl;
    return 0;
  }

  if (vm.count("text_log"))
  {
    redirectConsoleOutput();
  }

  if (vm.count("song"))
  {
    std::string songName = vm["song"].as<std::string>();
  }

  if (vm.count("debug"))
  {
    debug = true;
  }

  if (vm.count("all"))
  {
    vm.insert({"extractColour", po::variable_value()});
    vm.insert({"extractParticle", po::variable_value()});
    vm.insert({"extractObject", po::variable_value()});
    vm.insert({"extractBackground", po::variable_value()});
    vm.insert({"generateObjectPrompts", po::variable_value()});
    vm.insert({"generateBackgroundPrompts", po::variable_value()});
  }

  std::cout << "Starting LLM Pipeline" << std::endl;
  try
  {
    LLM llm(modelPath, songName, debug);
    if (vm.count("extractColour"))
    {
      llm.extractColours();
    }
    if (vm.count("extractParticle"))
    {
      llm.extractParticleEffect();
    }
    if (vm.count("extractObject"))
    {
      llm.extractObjects();
    }
    if (vm.count("extractBackground"))
    {
      llm.extractBackgrounds();
    }
    if (vm.count("generateObjectPrompts"))
    {
      llm.generateObjectPrompts();
    }
    if (vm.count("generateBackgroundPrompts"))
    {
      llm.generateBackgroundPrompts();
    }
    llm.jsonStoreData();
  }
  catch (const std::exception &e)
  {
    std::cerr << "Error: " << e.what() << std::endl;
    cleanup();
    return 1;
  }

  std::cout << "LLM Pipeline completed" << std::endl;

  if (vm.count("text_log"))
  {
    cleanup();
  }
  return 0;
}

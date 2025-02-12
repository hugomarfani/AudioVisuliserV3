#include <openvino/genai/llm_pipeline.hpp>
#include <openvino/openvino.hpp>
#include <nlohmann/json.hpp>
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

std::ofstream logFile;

using json = nlohmann::json;

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
    "Provide the fomatted output, followed by a brief explanation of why each color was chosen, in the following format:"
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
    "colour: black object with white background";

std::string backgroundSettings =
    "colour: colourful background"
    "suitable for children and family";

std::filesystem::path currentDirectory = std::filesystem::current_path();

std::string modelPath = (currentDirectory / "AiResources" / "gemma-2-9b-it-int4-ov").string();
std::string outputFilePath = (currentDirectory / "AiResources" / "./output.json").string();
std::string particleListFilePath = (currentDirectory / "AiResources" / "particleList.json").string();
std::string logPath = (currentDirectory / "AiResources" / "./log.txt").string();
std::filesystem::path lyricsDirPath = (currentDirectory / "AiResources" / "lyrics");

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
    if (device.find("GPU") != std::string::npos)
    {
      return device;
    }
  }
  return availableDevices[0];
}

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

void jsonStoreData(std::string colourOutput, std::string particleOutput)
{
  // create empty json object
  json j;
  // regex to match hex colours
  std::regex hexColour("#[0-9a-fA-F]{6}");
  // create iterator to iterate through matches
  std::sregex_iterator next(colourOutput.begin(), colourOutput.end(), hexColour);
  std::sregex_iterator end;
  // iterate through matches and store in json object
  while (next != end)
  {
    std::smatch match = *next;
    j["colours"].push_back(match.str());
    next++;
  }
  // store whole colour string in json object
  j["coloursReason"] = colourOutput;
  j["particleEffect"] = particleOutput;

  // write json object to file
  std::ofstream o(outputFilePath);
  o << std::setw(4) << j << std::endl;
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

auto getOptionsFromLlmOutput(std::string llmOutput)
{
  // regex to match all options, sandwiched by
  std::regex optionsRegex(": \$(.*?)\$");
  // create iterator to iterate through matches
  std::sregex_iterator next(llmOutput.begin(), llmOutput.end(), optionsRegex);
  std::sregex_iterator end;
  std::vector<std::string> options;
  // iterate through matches and store in vector
  while (next != end)
  {
    std::smatch match = *next;
    options.push_back(match.str());
    next++;
  }
  return options;
}

void mainInference(int argc, char *argv[])
{
  std::cout << "Starting Gemma Script" << std::endl;
  std::string device = getModelDevice();
  // print device
  std::cout << "Device: " << device << std::endl;
  std::cout << "Model Path: " << modelPath << std::endl;
  std::cout << "Initialising LLM Pipeline" << std::endl;
  ov::genai::LLMPipeline pipe(modelPath, device);
  std::cout << "LLM Pipeline initialised" << std::endl;

  // if -s flag exists, store it as songName
  std::string songName = "";
  if (argc == 3 && strcmp(argv[1], "-s") == 0)
  {
    songName = argv[2];
  }
  else
  {
    songName = "let it go";
  }

  // print song name
  std::cout << "Song Name: " << songName << std::endl;

  std::string lyrics = getLyrics(songName);
  // log lyrics has loaded
  std::cout << "Lyrics loaded" << std::endl;

  // extract colours from lyrics
  std::cout << "Extracting colours from lyrics" << std::endl;
  std::string colourPrompt = lyricsPrompt + " " + songName + "\n" + lyrics + colourExtractionPrompt;
  std::string colourOutput = pipe.generate(colourPrompt, ov::genai::max_new_tokens(500));
  std::cout << "Extracted colours from lyrics" << std::endl;

  std::cout << colourOutput << std::endl;

  // obtain list of particle effects
  std::cout << "Obtaining list of particle effects" << std::endl;
  json particles = getParticleEffectFromJson(particleListFilePath);
  std::cout << "Obtained list of particle effects" << std::endl;

  // extract particle effect from lyrics
  std::cout << "Extracting particle effect from lyrics" << std::endl;
  std::string particlePrompt = lyricsPrompt + " " + songName + "\n" + lyrics + particleSelectionPrompt + "\n" + particles.dump();
  std::string particleOutput = pipe.generate(particlePrompt, ov::genai::max_new_tokens(100));
  std::cout << "Extracted particle effect from lyrics" << std::endl;

  // extract objects from lyrics
  std::cout << "Extracting objects from lyrics" << std::endl;
  std::string objectPrompt = lyricsPrompt + " " + songName + "\n" + lyrics + objectExtractionPrompt;
  std::string objectOutput = pipe.generate(objectPrompt, ov::genai::max_new_tokens(100));
  std::cout << "Extracted objects from lyrics" << std::endl;

  // extract backgrounds from lyrics
  std::cout << "Extracting backgrounds from lyrics" << std::endl;
  std::string backgroundPrompt = lyricsPrompt + " " + songName + "\n" + lyrics + backgroundExtractionPrompt;
  std::string backgroundOutput = pipe.generate(backgroundPrompt, ov::genai::max_new_tokens(100));
  std::cout << "Extracted backgrounds from lyrics" << std::endl;

  // store data in json file
  std::cout << "Storing data in json file" << std::endl;
  jsonStoreData(colourOutput, particleOutput);
  std::cout << "Data stored in json file" << std::endl;
}

int main(int argc, char *argv[])
{
  // for logging
  redirectConsoleOutput();
  try
  {
    mainInference(argc, argv);
  }
  catch (const std::exception &e)
  {
    std::cerr << "Error: " << e.what() << std::endl;
  }
  catch (...)
  {
    std::cerr << "Error: Unknown error" << std::endl;
  }

  // for logging
  cleanup();
  return 0;
}

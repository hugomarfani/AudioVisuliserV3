#include <openvino/genai/llm_pipeline.hpp>
#include <openvino/openvino.hpp>
#include <iostream>
#include <string>
#include <tuple>
#include <vector>
#include <iterator>
#include <algorithm>

const char *colourExtractionPrompt = "Analyze the lyrics of the song provided and extract 5 unique,
unusual colors (avoid common colors like red, green, or blue) that are explicitly mentioned or strongly implied.
Represent each color in #RRGGBB hexadecimal format. Ensure the output is in the following exact format
for easy extraction using regex:
Color 1: #RRGGBB
Color 2: #RRGGBB
Color 3: #RRGGBB
Color 4: #RRGGBB
Color 5: #RRGGBB
If a color is not explicitly named, infer it from vivid imagery or metaphors in the lyrics.
Provide only the formatted output, no additional text."

const char *particleSelectionPrompt = " Analyze the lyrics of the song provided and choose 1 particle effect from the following list,
that best fits the mood and theme of the song:
"

const char *lyricsPrompt = "These are the lyrics for"

const char *modelPath = "./gemma-2-9b-it-int4-ov";

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

std::string getLyrics(char *songName)
{
    // read in lyrics from lyrics folder under song.txt
    std::string lyrics = "";
    std::string line;
    std::ifstream lyricsFile;
    lyricsFile.open("./lyrics/" + songName + ".txt");
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

int main(int argc, char *argv[])
{
    std::string device = getModelDevice();
    // print device
    std::cout << "Device: " << device << std::endl;
    std::cout << "Initialising LLM Pipeline" << std::endl;
    ov::genai::LLMPipeline pipe(model_path, device);
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

    std::string lyrics = getLyrics(songName);

    std::string output = pipe.generate("The Sun is yellow because", ov::genai::max_new_tokens(100));

    std::cout << output << std::endl;
}